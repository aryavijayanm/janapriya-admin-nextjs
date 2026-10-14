import { Spinner } from "@/components/ui/Spinner";

// Shown automatically by Next.js while any page under (protected) is loading
// its server data -- written once here instead of a "Loading..." state inside
// every table component. The sidebar and navbar stay on screen around it.
export default function ProtectedLoading() {
    return (
        <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
        </div>
    );
}
