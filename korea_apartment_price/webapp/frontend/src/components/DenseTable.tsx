import { Paper, SxProps, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Theme } from "@mui/material";

export interface ColumnInfo {
  headerName: JSX.Element | string;
  align?: 'inherit' | 'left' | 'center' | 'right' | 'justify';
  field: string
  headSx?: SxProps<Theme>;
  sx?: SxProps<Theme>;
  width?: number | string;
}

export interface DenseTableProp {
  columns: ColumnInfo[]
  rows: Record<string, any>[],
  minWidth?: number | string
  maxWidth?: number | string
  width?: number | string
  sx?: SxProps<Theme>;
  hideTitle?:boolean
};

const DenseTable: React.FC<DenseTableProp> = (prop: DenseTableProp) => {
  const minWidth = prop.minWidth;
  const maxWidth = prop.maxWidth;
  const width = prop.width;

  return (
    <TableContainer component={Paper} sx={prop.sx}>
      <Table sx={{ minWidth, maxWidth, width }} size="small" aria-label="a dense table">
        {(prop?.hideTitle) ? (<></>) : (
          <TableHead>
            <TableRow>
              {
                prop.columns.map(e => {
                  return <TableCell align={e.align} sx={e.headSx} width={e.width}>{e.headerName}</TableCell>
                })
              }
            </TableRow>
          </TableHead>)}
        <TableBody>
          {prop.rows.map((row, idx) => (
            <TableRow
              key={`${idx}`}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              {prop.columns.map((e, colidx)=>{
                return <TableCell key={`${idx}-${colidx}`} align={e.align} width={e.width} sx={e.headSx}>{row[e.field]}</TableCell>
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default DenseTable;