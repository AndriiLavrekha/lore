type PlaceholderTableProps = {
  columns: string[];
  rows: string[][];
};

export function PlaceholderTable({ columns, rows }: PlaceholderTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="bg-muted text-xs font-medium uppercase text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="px-4 py-3">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}:${row.join(":")}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cellIndex}:${cell}`} className="truncate px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
