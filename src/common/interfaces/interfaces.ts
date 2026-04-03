export interface PaginatedResult<T> {
  items: T[];
  meta: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}