/** The "available to the operator only" view (FR-037, FR-038), shared by Ask and Library. */
export function OperatorOnly({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md rounded-lg bg-muted p-6 text-center text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}
