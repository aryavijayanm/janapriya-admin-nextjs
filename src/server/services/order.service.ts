import "server-only";

import { randomInt } from "node:crypto";
import { Prisma, type Branch, type Role } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { escapeLike } from "@/server/db/like";
import { paginate, type PaginatedResult } from "@/server/db/paginate";
import { todayInKerala } from "@/server/domain/age";
import { calculateContractDates, nextContractOpensOn } from "@/server/domain/contract-dates";
import { formatDayMonthYear, fromDayNumber, fromIsoDate, toDayNumber } from "@/server/domain/days";
import { dutyPeriodsClash, type DutyPeriodFacts } from "@/server/domain/duty";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/domain/errors";
import { ALL_ROLES, assertRole, type AuthUser } from "@/server/services/authz";
import { staffSearchWhere } from "@/server/services/staff.service";
import { parseCustomerCode } from "@/server/validators/customer";
import {
    ORDER_CODE_CHARACTERS,
    ORDER_CODE_LENGTH,
    type ContractMoneyInput,
    type EditDutyInput,
    type OrderInput,
    type OrderListQuery,
    type OrderStatusValue,
    type StartCareInput,
    type UpdateDutyInput,
} from "@/server/validators/order";

// Orders, contracts and staff duty (step 1). Every function takes (db, user, ...)
// and checks permissions itself, like the other services.
//
// Wording: a "duty period" is one entry in an order's Duty list -- one
// StaffAssignment row: this staff member worked on this order from one date
// to another (or until now).

type Tx = Prisma.TransactionClient;

/** Who may use the order module -- every role, with the branch rule below. */
const ORDER_MODULE_ROLES: Role[] = [...ALL_ROLES];
/** Only these roles may change an order's branch (it decides OUTSIDER visibility). */
const BRANCH_EDIT_ROLES: Role[] = ["OWNER", "STAFF"];
const ORDER_CODE_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * The branch rule, applied to EVERY order query: an OUTSIDER never sees an
 * OUTSIDE-branch order. To them a hidden order behaves exactly like one that
 * doesn't exist (404), so even its existence isn't revealed.
 */
function visibleOrders(user: AuthUser): Prisma.CustomerOrderWhereInput {
    return user.role === "OUTSIDER" ? { branch: { not: "OUTSIDE" } } : {};
}

/** Is this order hidden from this user? */
function isHiddenFrom(user: AuthUser, branch: Branch): boolean {
    return user.role === "OUTSIDER" && branch === "OUTSIDE";
}

/** Today in Kerala, as a DATE value. */
function today(): Date {
    return fromIsoDate(todayInKerala());
}

/**
 * Duty is entered only after it has really happened (staff may or may not
 * turn up as planned), so no duty date may be in the future.
 */
function assertNotFuture(date: Date, label: string) {
    if (toDayNumber(date) > toDayNumber(today())) {
        throw new ValidationError(`${label} can't be in the future. Enter duty once it has happened.`);
    }
}

function isPrismaError(error: unknown, code: "P2002"): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/** 4 random characters from the order-code alphabet, e.g. "K7QT". */
function generateOrderCode(): string {
    let code = "";
    for (let i = 0; i < ORDER_CODE_LENGTH; i++) {
        // crypto randomness, not Math.random(): the point of the code is that it can't be guessed.
        code += ORDER_CODE_CHARACTERS[randomInt(ORDER_CODE_CHARACTERS.length)];
    }
    return code;
}

/** Waiting (no contract yet) / Active / Ended -- worked out, never stored. */
function statusOf(order: { endDate: Date | null; contracts: unknown[] }): OrderStatusValue {
    if (order.endDate !== null) return "ENDED";
    return order.contracts.length === 0 ? "WAITING" : "ACTIVE";
}

/** A visible, not-ended order (or an error), with what write operations check. */
async function getVisibleOrderForUpdate(tx: Tx, user: AuthUser, orderId: number) {
    const order = await tx.customerOrder.findFirst({
        where: { AND: [{ id: orderId }, visibleOrders(user)] },
        select: { id: true, code: true, branch: true, endDate: true, _count: { select: { contracts: true } } },
    });
    if (!order) throw new NotFoundError("Order not found");
    if (order.endDate !== null) throw new ValidationError("This order has ended and can't be changed");
    return order;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const ORDER_LIST_INCLUDE = {
    customer: { select: { id: true, name: true } },
    services: { include: { service: { select: { abbreviation: true } } } },
    contracts: {
        orderBy: { contractNumber: "asc" },
        select: { contractNumber: true, startDate: true, endDate: true },
    },
    duties: { select: { startDate: true, endDate: true, staff: { select: { name: true } } } },
} satisfies Prisma.CustomerOrderInclude;

type OrderListRow = Prisma.CustomerOrderGetPayload<{ include: typeof ORDER_LIST_INCLUDE }>;

/** One row of an order list. */
export interface OrderListItem {
    id: number;
    code: string;
    branch: Branch;
    status: OrderStatusValue;
    customer: { id: number; name: string };
    serviceAbbreviations: string[];
    /** Whoever covers today, if anyone. */
    currentStaff: string | null;
    /** The contract covering today (else the latest started, else #1). */
    currentContract: { contractNumber: number; startDate: Date | null; endDate: Date | null } | null;
}

function covers(start: Date | null, end: Date | null, day: number): boolean {
    return start !== null && toDayNumber(start) <= day && (end === null || day <= toDayNumber(end));
}

function toListItem(order: OrderListRow, todayDay: number): OrderListItem {
    const currentContract =
        order.contracts.find((c) => covers(c.startDate, c.endDate, todayDay)) ??
        [...order.contracts].reverse().find((c) => c.startDate !== null && toDayNumber(c.startDate) <= todayDay) ??
        order.contracts[0] ??
        null;
    const currentDuty = order.duties.find((d) => covers(d.startDate, d.endDate, todayDay));

    return {
        id: order.id,
        code: order.code,
        branch: order.branch,
        status: statusOf(order),
        customer: order.customer,
        serviceAbbreviations: order.services.map((link) => link.service.abbreviation),
        currentStaff: currentDuty?.staff.name ?? null,
        currentContract,
    };
}

/** One page of the order list, newest first, with status / branch / search filters. */
export async function listOrders(
    db: Db,
    user: AuthUser,
    query: OrderListQuery,
): Promise<PaginatedResult<OrderListItem>> {
    assertRole(user, ORDER_MODULE_ROLES);

    const conditions: Prisma.CustomerOrderWhereInput[] = [visibleOrders(user)];
    if (query.branch) conditions.push({ branch: query.branch });
    if (query.status === "WAITING") conditions.push({ endDate: null, contracts: { none: {} } });
    if (query.status === "ACTIVE") conditions.push({ endDate: null, contracts: { some: {} } });
    if (query.status === "ENDED") conditions.push({ endDate: { not: null } });

    if (query.search) {
        const term = escapeLike(query.search);
        const customerId = parseCustomerCode(query.search);
        conditions.push({
            OR: [
                { code: query.search.trim().toUpperCase() },
                ...(customerId !== null ? [{ customerId }] : []),
                { customer: { name: { contains: term, mode: "insensitive" } } },
                { customer: { contactNumber1: { contains: term, mode: "insensitive" } } },
                { customer: { contactNumber2: { contains: term, mode: "insensitive" } } },
            ],
        });
    }

    const where: Prisma.CustomerOrderWhereInput = { AND: conditions };
    const todayDay = toDayNumber(today());

    const result = await paginate(
        () => db.customerOrder.count({ where }),
        (skip, take) =>
            db.customerOrder.findMany({
                skip,
                take,
                where,
                include: ORDER_LIST_INCLUDE,
                // id as a tiebreaker, so rows can't repeat or vanish between pages.
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            }),
        query.page,
    );
    return { ...result, data: result.data.map((order) => toListItem(order, todayDay)) };
}

/** A customer's orders, for their details page (the branch rule applies here too). */
export async function listOrdersForCustomer(db: Db, user: AuthUser, customerId: number): Promise<OrderListItem[]> {
    assertRole(user, ORDER_MODULE_ROLES);
    const orders = await db.customerOrder.findMany({
        where: { AND: [{ customerId }, visibleOrders(user)] },
        include: ORDER_LIST_INCLUDE,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const todayDay = toDayNumber(today());
    return orders.map((order) => toListItem(order, todayDay));
}

const ORDER_DETAILS_INCLUDE = {
    customer: { select: { id: true, name: true, status: true, contactNumber1: true, address: true } },
    services: { include: { service: true }, orderBy: { service: { name: "asc" } } },
    contracts: { orderBy: { contractNumber: "asc" } },
    duties: {
        orderBy: [{ startDate: "asc" }, { id: "asc" }],
        include: { staff: { select: { id: true, name: true, place: true, contactNumber: true } } },
    },
} satisfies Prisma.CustomerOrderInclude;

/** Everything the order page shows. */
export type OrderDetails = Prisma.CustomerOrderGetPayload<{ include: typeof ORDER_DETAILS_INCLUDE }> & {
    status: OrderStatusValue;
};

/** One order by its code, or null (missing -- or hidden from this user). */
export async function getOrderByCode(db: Db, user: AuthUser, code: string): Promise<OrderDetails | null> {
    assertRole(user, ORDER_MODULE_ROLES);
    const order = await db.customerOrder.findFirst({
        where: { AND: [{ code }, visibleOrders(user)] },
        include: ORDER_DETAILS_INCLUDE,
    });
    return order ? { ...order, status: statusOf(order) } : null;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/** Every chosen service must currently be offered, or already be on this order. */
async function assertServicesAllowed(tx: Tx, serviceIds: number[], alreadyLinked: number[] = []) {
    const allowed = await tx.service.count({
        where: { id: { in: serviceIds }, OR: [{ is_active: true }, { id: { in: alreadyLinked } }] },
    });
    if (allowed !== serviceIds.length) {
        throw new ValidationError("One of the selected services is no longer offered");
    }
}

export async function createOrder(db: Db, user: AuthUser, input: OrderInput): Promise<{ code: string }> {
    assertRole(user, ORDER_MODULE_ROLES);

    // OUTSIDER: the branch field is hidden and the order is always Kerala --
    // otherwise their new order would vanish from their own view on saving.
    const branch: Branch = user.role === "OUTSIDER" ? "KERALA" : input.branch;

    const customer = await db.customer.findUnique({ where: { id: input.customerId }, select: { status: true } });
    if (!customer) throw new NotFoundError("Customer not found");
    if (customer.status !== "ACTIVE") {
        throw new ValidationError("Orders can only be created for active customers");
    }
    await assertServicesAllowed(db, input.serviceIds);

    // A new random code, retried if it happens to exist already (the unique
    // index decides). With 810,000 possible codes a clash is rare.
    for (let attempt = 0; attempt < ORDER_CODE_ATTEMPTS; attempt++) {
        try {
            return await db.customerOrder.create({
                data: {
                    code: generateOrderCode(),
                    customerId: input.customerId,
                    branch,
                    remarks: input.remarks,
                    services: { create: input.serviceIds.map((serviceId) => ({ serviceId })) },
                },
                select: { code: true },
            });
        } catch (error) {
            if (!isPrismaError(error, "P2002")) throw error;
        }
    }
    throw new Error("Could not generate a unique order code");
}

/** Branch, services and remarks. The customer of an order never changes. */
export async function updateOrder(
    db: Db,
    user: AuthUser,
    orderId: number,
    input: OrderInput,
): Promise<{ code: string }> {
    assertRole(user, ORDER_MODULE_ROLES);

    return db.$transaction(async (tx) => {
        await getVisibleOrderForUpdate(tx, user, orderId);
        const existing = await tx.customerOrder.findUniqueOrThrow({
            where: { id: orderId },
            select: { code: true, branch: true, services: { select: { serviceId: true } } },
        });

        if (input.branch !== existing.branch && !BRANCH_EDIT_ROLES.includes(user.role)) {
            throw new ForbiddenError("Only the owner or staff can change an order's branch");
        }

        const linked = existing.services.map((s) => s.serviceId);
        await assertServicesAllowed(tx, input.serviceIds, linked);

        await tx.customerOrder.update({
            where: { id: orderId },
            data: { branch: input.branch, remarks: input.remarks },
        });

        // Sync the services to exactly the submitted set.
        const toAdd = input.serviceIds.filter((id) => !linked.includes(id));
        const toRemove = linked.filter((id) => !input.serviceIds.includes(id));
        if (toAdd.length > 0) {
            await tx.orderService.createMany({ data: toAdd.map((serviceId) => ({ orderId, serviceId })) });
        }
        if (toRemove.length > 0) {
            await tx.orderService.deleteMany({ where: { orderId, serviceId: { in: toRemove } } });
        }

        return { code: existing.code };
    });
}

// ---------------------------------------------------------------------------
// Duty checks and contract recalculation
// ---------------------------------------------------------------------------

/**
 * Throws unless `candidate` (a duty period) may be saved on `orderId`: the
 * staff member is Active (when newly placed) and the period clashes with
 * nothing -- neither that staff member's periods on ANY order, nor other
 * periods on THIS order -- apart from one shared day that is half + half, or
 * no pay for one of them (see dutyPeriodsClash).
 */
async function assertDutyAllowed(
    tx: Tx,
    user: AuthUser,
    orderId: number,
    candidate: DutyPeriodFacts,
    options: { excludeDutyId?: number; requireActiveStaff: boolean },
) {
    const staff = await tx.staff.findUnique({ where: { id: candidate.staffId }, select: { name: true, status: true } });
    if (!staff) throw new NotFoundError("Staff not found");
    if (options.requireActiveStaff && staff.status !== "ACTIVE") {
        throw new ValidationError(`${staff.name} is not active and can't be put on duty`);
    }

    const others = await tx.staffAssignment.findMany({
        where: {
            ...(options.excludeDutyId !== undefined ? { id: { not: options.excludeDutyId } } : {}),
            OR: [{ staffId: candidate.staffId }, { orderId }],
        },
        include: { order: { select: { code: true, branch: true } }, staff: { select: { name: true } } },
    });

    for (const other of others) {
        if (!dutyPeriodsClash(candidate, other)) continue;

        const when =
            `from ${formatDayMonthYear(other.startDate)}` +
            (other.endDate ? ` to ${formatDayMonthYear(other.endDate)}` : " onwards");

        if (other.staffId === candidate.staffId) {
            // Busy on an order hidden from this user: say nothing about it.
            if (other.orderId !== orderId && isHiddenFrom(user, other.order.branch)) {
                throw new ValidationError("This staff member isn't available on those dates");
            }
            const where = other.orderId === orderId ? "this order" : `order ${other.order.code}`;
            throw new ValidationError(`${staff.name} is already on ${where} ${when}`);
        }
        throw new ValidationError(
            `${other.staff.name} is on duty on this order ${when}. Stop them first. A shared day must be half + half, or one of them no pay.`,
        );
    }
}

/**
 * Recalculates and stores every contract's dates and served days for an
 * order, from its duty periods. Runs inside the same transaction as every
 * duty change, so the stored dates never disagree with the duty periods.
 * Contract #1 starts with the earliest duty period.
 */
async function recalculateContracts(tx: Tx, orderId: number) {
    const [duties, contracts] = await Promise.all([
        // Day parts too: NO_PAY first/last days are not served days.
        tx.staffAssignment.findMany({
            where: { orderId },
            select: { startDate: true, startDayPart: true, endDate: true, endDayPart: true },
        }),
        tx.contract.findMany({ where: { orderId }, orderBy: { contractNumber: "asc" }, select: { id: true } }),
    ]);
    if (contracts.length === 0) return;

    if (duties.length === 0) {
        for (const contract of contracts) {
            await tx.contract.update({
                where: { id: contract.id },
                data: { startDate: null, endDate: null, servedDays: 0 },
            });
        }
        return;
    }

    const firstStart = fromDayNumber(Math.min(...duties.map((d) => toDayNumber(d.startDate))));
    const dates = calculateContractDates(firstStart, duties, contracts.length);
    for (let i = 0; i < contracts.length; i++) {
        await tx.contract.update({ where: { id: contracts[i].id }, data: dates[i] });
    }
}

// ---------------------------------------------------------------------------
// Start care, duty changes
// ---------------------------------------------------------------------------

/** Creates contract #1 and the first duty period together. */
export async function startCare(
    db: Db,
    user: AuthUser,
    orderId: number,
    input: StartCareInput,
): Promise<{ code: string }> {
    assertRole(user, ORDER_MODULE_ROLES);

    return db.$transaction(async (tx) => {
        const order = await getVisibleOrderForUpdate(tx, user, orderId);
        if (order._count.contracts > 0) throw new ValidationError("Care has already started for this order");

        const duty: DutyPeriodFacts = {
            staffId: input.staffId,
            startDate: fromIsoDate(input.startDate),
            startDayPart: input.startDayPart,
            endDate: null,
            endDayPart: null,
        };
        assertNotFuture(duty.startDate, "The start date");
        await assertDutyAllowed(tx, user, orderId, duty, { requireActiveStaff: true });

        await tx.staffAssignment.create({ data: { orderId, ...duty } });
        await tx.contract.create({
            data: { orderId, contractNumber: 1, rate: input.rate, staffSalary: input.staffSalary },
        });
        await recalculateContracts(tx, orderId);
        return { code: order.code };
    });
}

/**
 * The one "Update duty" button:
 *   stop  -- whoever is on duty stops (optionally with a note), and optionally
 *            the next staff starts (a handover)
 *   start -- nobody is on duty, so someone starts (a return, or new staff)
 */
export async function updateDuty(
    db: Db,
    user: AuthUser,
    orderId: number,
    input: UpdateDutyInput,
): Promise<{ code: string }> {
    assertRole(user, ORDER_MODULE_ROLES);

    return db.$transaction(async (tx) => {
        const order = await getVisibleOrderForUpdate(tx, user, orderId);
        if (order._count.contracts === 0) throw new ValidationError("Start care for this order first");

        const open = await tx.staffAssignment.findFirst({
            where: { orderId, endDate: null },
            include: { staff: { select: { name: true } } },
        });

        if (input.mode === "stop") {
            if (!open) throw new ValidationError("Nobody is on duty on this order right now");
            const stopDate = fromIsoDate(input.stopDate);
            assertNotFuture(stopDate, "The stop date");
            if (toDayNumber(stopDate) < toDayNumber(open.startDate)) {
                throw new ValidationError(
                    `The stop date can't be before ${open.staff.name} started (${formatDayMonthYear(open.startDate)})`,
                );
            }
            await tx.staffAssignment.update({
                where: { id: open.id },
                data: { endDate: stopDate, endDayPart: input.stopDayPart, endNote: input.endNote },
            });

            if (input.next) {
                const next: DutyPeriodFacts = {
                    staffId: input.next.staffId,
                    startDate: fromIsoDate(input.next.startDate),
                    startDayPart: input.next.startDayPart,
                    endDate: null,
                    endDayPart: null,
                };
                assertNotFuture(next.startDate, "The next staff's start date");
                // Checked AFTER the stop is saved, so the handover day is judged
                // against the stop just entered.
                await assertDutyAllowed(tx, user, orderId, next, { requireActiveStaff: true });
                await tx.staffAssignment.create({ data: { orderId, ...next } });
            }
        } else {
            if (open) {
                throw new ValidationError(`${open.staff.name} is still on duty. Stop them first.`);
            }
            const duty: DutyPeriodFacts = {
                staffId: input.staffId,
                startDate: fromIsoDate(input.startDate),
                startDayPart: input.startDayPart,
                endDate: null,
                endDayPart: null,
            };
            assertNotFuture(duty.startDate, "The start date");
            await assertDutyAllowed(tx, user, orderId, duty, { requireActiveStaff: true });
            await tx.staffAssignment.create({ data: { orderId, ...duty } });
        }

        await recalculateContracts(tx, orderId);
        return { code: order.code };
    });
}

/** Correcting one duty period directly (wrong staff picked, wrong dates). */
export async function editDuty(
    db: Db,
    user: AuthUser,
    orderId: number,
    dutyId: number,
    input: EditDutyInput,
): Promise<{ code: string }> {
    assertRole(user, ORDER_MODULE_ROLES);

    return db.$transaction(async (tx) => {
        const order = await getVisibleOrderForUpdate(tx, user, orderId);
        const existing = await tx.staffAssignment.findFirst({ where: { id: dutyId, orderId }, select: { staffId: true } });
        if (!existing) throw new NotFoundError("Duty period not found");

        const candidate: DutyPeriodFacts = {
            staffId: input.staffId,
            startDate: fromIsoDate(input.startDate),
            startDayPart: input.startDayPart,
            endDate: input.endDate ? fromIsoDate(input.endDate) : null,
            endDayPart: input.endDate ? (input.endDayPart ?? "FULL") : null,
        };
        assertNotFuture(candidate.startDate, "The start date");
        if (candidate.endDate) assertNotFuture(candidate.endDate, "The stop date");
        // Correcting dates on a period whose staff has since been disabled is
        // fine; putting a DIFFERENT, inactive staff member on it is not.
        await assertDutyAllowed(tx, user, orderId, candidate, {
            excludeDutyId: dutyId,
            requireActiveStaff: input.staffId !== existing.staffId,
        });

        await tx.staffAssignment.update({
            where: { id: dutyId },
            data: { ...candidate, endNote: input.endDate ? input.endNote : null },
        });
        await recalculateContracts(tx, orderId);
        return { code: order.code };
    });
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

/**
 * Adds the next contract with the given rate and staff salary. Allowed from
 * nextContractOpensOn() (2 days before the latest contract ends); since the new
 * contract then becomes the latest, only one upcoming contract can exist.
 */
export async function startNextContract(
    db: Db,
    user: AuthUser,
    orderId: number,
    input: ContractMoneyInput,
): Promise<{ code: string }> {
    assertRole(user, ORDER_MODULE_ROLES);

    return db.$transaction(async (tx) => {
        const order = await getVisibleOrderForUpdate(tx, user, orderId);
        const latest = await tx.contract.findFirst({ where: { orderId }, orderBy: { contractNumber: "desc" } });
        if (!latest) throw new ValidationError("Start care for this order first");
        if (!latest.endDate) {
            throw new ValidationError(
                `Contract #${latest.contractNumber}'s end date isn't known yet: nobody is on duty`,
            );
        }

        const opensOn = nextContractOpensOn(latest.endDate);
        if (toDayNumber(today()) < toDayNumber(opensOn)) {
            throw new ValidationError(`The next contract can be started from ${formatDayMonthYear(opensOn)}`);
        }

        try {
            await tx.contract.create({
                data: {
                    orderId,
                    contractNumber: latest.contractNumber + 1,
                    rate: input.rate,
                    staffSalary: input.staffSalary,
                },
            });
        } catch (error) {
            // Two people pressing the button at once: the unique rule refuses the second.
            if (isPrismaError(error, "P2002")) {
                throw new ValidationError("Another contract was just started for this order. Refresh the page.");
            }
            throw error;
        }

        await recalculateContracts(tx, orderId);
        return { code: order.code };
    });
}

/** Edits a contract's rate and staff salary (freely in step 1; step 2 adds the paid lock). */
export async function updateContractMoney(
    db: Db,
    user: AuthUser,
    contractId: number,
    input: ContractMoneyInput,
): Promise<{ code: string }> {
    assertRole(user, ORDER_MODULE_ROLES);

    return db.$transaction(async (tx) => {
        const contract = await tx.contract.findUnique({ where: { id: contractId }, select: { orderId: true } });
        if (!contract) throw new NotFoundError("Contract not found");
        const order = await getVisibleOrderForUpdate(tx, user, contract.orderId);

        await tx.contract.update({
            where: { id: contractId },
            data: { rate: input.rate, staffSalary: input.staffSalary },
        });
        return { code: order.code };
    });
}

/**
 * Removes a contract started by mistake ("Start next contract" pressed, then
 * the customer stopped). Only the LATEST contract, never #1, and only while it
 * has 0 served days -- so no worked day, and no history, can ever be lost.
 * (Step 2 adds: and no payments against it.)
 */
export async function deleteLatestContract(db: Db, user: AuthUser, contractId: number): Promise<{ code: string }> {
    assertRole(user, ORDER_MODULE_ROLES);

    return db.$transaction(async (tx) => {
        const contract = await tx.contract.findUnique({
            where: { id: contractId },
            select: { orderId: true, contractNumber: true, servedDays: true },
        });
        if (!contract) throw new NotFoundError("Contract not found");
        const order = await getVisibleOrderForUpdate(tx, user, contract.orderId);

        if (contract.contractNumber === 1) {
            throw new ValidationError("Contract #1 can't be deleted");
        }
        const latest = await tx.contract.findFirst({
            where: { orderId: contract.orderId },
            orderBy: { contractNumber: "desc" },
            select: { contractNumber: true },
        });
        if (latest?.contractNumber !== contract.contractNumber) {
            throw new ValidationError("Only the latest contract can be deleted");
        }
        // servedDays is recalculated with every duty change, so it's current here.
        if (contract.servedDays > 0) {
            throw new ValidationError(
                `Contract #${contract.contractNumber} already has ${contract.servedDays} served days, so it can't be deleted`,
            );
        }

        await tx.contract.delete({ where: { id: contractId } });
        return { code: order.code };
    });
}

// ---------------------------------------------------------------------------
// Staff picker
// ---------------------------------------------------------------------------

/** A staff member as the picker shows them. */
export interface AssignableStaff {
    id: number;
    name: string;
    place: string;
    rating: number;
    /** Can do at least one of the order's services. */
    matchesServices: boolean;
    /** Already on another order on the chosen date -- shown greyed out. */
    busy: { orderCode: string; until: Date | null } | null;
}

/** Enough for any real staff list (hundreds), small enough to stay quick. */
const PICKER_LIMIT = 300;

/**
 * Active staff for the picker. By default only those who can do the order's
 * services; `includeAll` adds everyone else. Sorted matching first, then by
 * rating (high to low). Staff busy on another order on `onDate` are marked.
 *
 * For an OUTSIDER, staff busy on an OUTSIDE order are left out entirely --
 * showing them at all would reveal that a hidden order exists.
 */
export async function listAssignableStaff(
    db: Db,
    user: AuthUser,
    params: { orderId: number; search?: string; includeAll: boolean; onDate: string },
): Promise<AssignableStaff[]> {
    assertRole(user, ORDER_MODULE_ROLES);

    const order = await db.customerOrder.findFirst({
        where: { AND: [{ id: params.orderId }, visibleOrders(user)] },
        select: { services: { select: { serviceId: true } } },
    });
    if (!order) throw new NotFoundError("Order not found");
    const orderServiceIds = order.services.map((s) => s.serviceId);

    const staff = await db.staff.findMany({
        where: {
            AND: [
                { status: "ACTIVE" },
                params.search ? staffSearchWhere(params.search) : {},
                params.includeAll ? {} : { services: { some: { serviceId: { in: orderServiceIds } } } },
            ],
        },
        select: { id: true, name: true, place: true, rating: true, services: { select: { serviceId: true } } },
        orderBy: [{ rating: "desc" }, { name: "asc" }],
        take: PICKER_LIMIT,
    });

    const day = fromIsoDate(params.onDate);
    const busyDuties = await db.staffAssignment.findMany({
        where: {
            staffId: { in: staff.map((s) => s.id) },
            orderId: { not: params.orderId },
            startDate: { lte: day },
            // "gt", not "gte": someone whose other duty ENDS on this day may
            // still share it (half + half, or a no-pay day) -- so they stay
            // pickable, and assertDutyAllowed decides on the exact day parts.
            OR: [{ endDate: null }, { endDate: { gt: day } }],
        },
        select: { staffId: true, endDate: true, order: { select: { code: true, branch: true } } },
    });

    const result: AssignableStaff[] = [];
    for (const s of staff) {
        const busyDuty = busyDuties.find((d) => d.staffId === s.id);
        // Busy on an order hidden from this user: leave them out entirely.
        if (busyDuty && isHiddenFrom(user, busyDuty.order.branch)) continue;

        result.push({
            id: s.id,
            name: s.name,
            place: s.place,
            rating: s.rating,
            matchesServices: s.services.some((link) => orderServiceIds.includes(link.serviceId)),
            busy: busyDuty ? { orderCode: busyDuty.order.code, until: busyDuty.endDate } : null,
        });
    }

    return result.sort(
        (a, b) => Number(b.matchesServices) - Number(a.matchesServices) || b.rating - a.rating || a.name.localeCompare(b.name),
    );
}
