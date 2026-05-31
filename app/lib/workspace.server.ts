export type WorkspaceSummary = {
  storeLabel: string;
  corpusStatus: string;
};

export function getWorkspaceSummary(): WorkspaceSummary {
  return {
    storeLabel: "SQLite/libSQL boundary",
    corpusStatus: "Scaffold only; corpus features land in later plan tasks.",
  };
}
