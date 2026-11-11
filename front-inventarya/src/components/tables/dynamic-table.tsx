import { Button, Input, Pagination, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@nextui-org/react';
import { RenderCell } from './render-cell';
import { useState } from 'react';
import { FaPlus } from 'react-icons/fa6';


interface Props {
  stringSearch: string;
  onCreate: () => void | null;
  data: (string | number)[][] | any;
  columns: { name: string; uid: string }[];
  onEdit: (id: any | Record<string, any>) => void;
  onDelete: (id: any | null) => void;
  onView: (id: any) => void;
}

export const DynamicTable = ({ stringSearch, onCreate, data, columns, onEdit, onDelete, onView }: Props) => {

  const itemsPerPage = 10; // Número de elementos por página
  const [currentPage, setCurrentPage] = useState(1); // Estado para la página actual
  const [searchQuery, setSearchQuery] = useState(''); // Estado para el campo de búsqueda

  // Filtrar los datos según la búsqueda
  let filteredData: any[] = [];
  if(data.length > 0){
    filteredData = data.filter((item: any) => {
      if (item[stringSearch] === null || item[stringSearch] === undefined) {
        return;
    }else{  
      return item[stringSearch].toString().toLowerCase().includes(searchQuery.toLowerCase())
    }   
  });
  }else{
    filteredData = [];
  }
  // Cálculo del índice de los elementos a mostrar
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  // Cambio de página
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  // Manejar el cambio en el campo de búsqueda
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1); // Reiniciar a la primera página al buscar
  };

  return (
    <>
      <div className="flex justify-between flex-wrap gap-4 items-center">
        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
          <Input
            isClearable={true}
            placeholder='Buscar...'
            value={searchQuery}
            onChange={handleSearchChange}
            classNames={{
              input: "w-full",
              mainWrapper: "w-full",
            }}
          />
        </div>

        <div className="flex flex-row gap-3.5 flex-wrap">
          {/* Icon Plus */}
          {onCreate && (
            <Button onClick={onCreate} color="primary" >
            <FaPlus size={18} /><span className="me-1" >Nuevo</span>
          </Button>
          )}
        </div>
      </div>

      <div className="max-w-[95rem] mx-auto w-full mt-1">
        <Table aria-label="Searchable Paginated Table">
          <TableHeader columns={columns}>
            {currentItems.length > 0 ? (
              (column) => (
                <TableColumn
                  key={column.uid}
                  /* hideHeader={column.uid === "actions"} */
                  align={column.uid === "actions" ? "end" : "start"}
                >
                  {column.name}
                </TableColumn>
              )
            ) : (
              <TableColumn >Resultado</TableColumn >
            )}
          </TableHeader>
          <TableBody items={currentItems}>
            {currentItems.length > 0 ? (
              (item) => (
                <TableRow>
                  {(columnKey) => (
                    <TableCell>
                      {RenderCell({ item: item, columnKey: columnKey, onEdit: onEdit, onDelete: onDelete, onView: onView })}
                    </TableCell>
                  )}
                </TableRow>
              )
            ) : (
              <TableRow>
                <TableCell>No se encontraron resultados</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {/* Paginación alineada al centro */}
        <div className="flex justify-center mt-4">


          {filteredData.length > itemsPerPage && (
            <Pagination
              total={Math.ceil(filteredData.length / itemsPerPage)} // Total de páginas
              initialPage={1}
              showShadow
              color="warning"
              showControls
              onChange={(page) => handlePageChange(page)}
            />
          )}</div>
      </div>
    </>
  );
};