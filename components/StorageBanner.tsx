/** Says plainly whether anything is being kept. Shown on every page. */
export default function StorageBanner({
  storage,
}: {
  storage?: { persistent: boolean; message: string } | null;
}) {
  if (!storage) return null;
  return (
    <div className={`banner${storage.persistent ? " ok" : ""}`}>
      {storage.persistent ? "✓ " : "⚠ "}
      {storage.message}
    </div>
  );
}
