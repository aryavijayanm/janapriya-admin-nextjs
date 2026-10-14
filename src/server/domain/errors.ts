// Pure error types -- no framework, no HTTP status codes, no Prisma.
//
// Services throw these; the adapter layer (a Server Action, a Route Handler,
// or a NestJS exception filter after the split) decides how each one is
// presented. That split is the point: a service must not know whether its
// caller renders a form error or returns a 403.

export class DomainError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

/** Credentials rejected, or no valid session. */
export class AuthError extends DomainError {}

/** Authenticated, but not allowed to do this. */
export class ForbiddenError extends DomainError {}

/** The requested record does not exist. */
export class NotFoundError extends DomainError {}

/** The input is well-formed but breaks a business rule. */
export class ValidationError extends DomainError {}
