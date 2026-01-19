'use client';

import { DataTableAdvancedToolbar } from '@/components/data-table/data-table-advanced-toolbar';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableFacetedFilter } from '@/components/data-table/data-table-faceted-filter';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { CreditDetailViewer } from '@/components/settings/credits/credit-detail-viewer';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LOG_ACTION } from '@/credits/grant';
import type { CreditTransaction } from '@/credits/types';
import { formatDate } from '@/lib/formatter';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  BanknoteIcon,
  ClockIcon,
  CoinsIcon,
  GiftIcon,
  HandCoinsIcon,
  RotateCcwIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../ui/badge';
import { Skeleton } from '../../ui/skeleton';

function TableRowSkeleton({ columns }: { columns: number }) {
  return (
    <TableRow className="h-14">
      {Array.from({ length: columns }).map((_, index) => {
        if (index === 0) {
          // First column: Type column with icon + badge structure
          return (
            <TableCell key={index} className="py-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-32" />
              </div>
            </TableCell>
          );
        }
        if (index === 1) {
          // Second column: Amount column - complex structure
          return (
            <TableCell key={index} className="py-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-20" />
              </div>
            </TableCell>
          );
        }
        if (index === 4) {
          // PaymentId column: Badge structure
          return (
            <TableCell key={index} className="py-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-24" />
              </div>
            </TableCell>
          );
        }
        // Other columns: Regular text content
        return (
          <TableCell key={index} className="py-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
            </div>
          </TableCell>
        );
      })}
    </TableRow>
  );
}

interface CreditTransactionsTableProps {
  data: CreditTransaction[];
  total: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  sorting: SortingState;
  filters?: ColumnFiltersState;
  loading?: boolean;
  onSearch: (search: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSortingChange?: (sorting: SortingState) => void;
  onFiltersChange?: (filters: ColumnFiltersState) => void;
}

/**
 * https://www.diceui.com/docs/components/data-table
 */
export function CreditTransactionsTable({
  data,
  total,
  pageIndex,
  pageSize,
  search,
  sorting,
  filters,
  loading,
  onSearch,
  onPageChange,
  onPageSizeChange,
  onSortingChange,
  onFiltersChange,
}: CreditTransactionsTableProps) {
  const t = useTranslations('Dashboard.settings.credits.transactions');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Get transaction type icon (using new LOG_ACTION values)
  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case LOG_ACTION.GRANTED:
        return <BanknoteIcon className="h-5 w-5" />;
      case LOG_ACTION.CONSUMED:
        return <CoinsIcon className="h-5 w-5" />;
      case LOG_ACTION.EXPIRED:
        return <ClockIcon className="h-5 w-5" />;
      case LOG_ACTION.REFUNDED:
        return <RotateCcwIcon className="h-5 w-5" />;
      case LOG_ACTION.HELD:
        return <HandCoinsIcon className="h-5 w-5" />;
      case LOG_ACTION.RELEASED:
        return <GiftIcon className="h-5 w-5" />;
      default:
        return null;
    }
  };

  // Get transaction type display name (using new LOG_ACTION values)
  const getTransactionTypeDisplayName = (type: string) => {
    switch (type) {
      case LOG_ACTION.GRANTED:
        return t('types.granted');
      case LOG_ACTION.CONSUMED:
        return t('types.consumed');
      case LOG_ACTION.EXPIRED:
        return t('types.expired');
      case LOG_ACTION.REFUNDED:
        return t('types.refunded');
      case LOG_ACTION.HELD:
        return t('types.held');
      case LOG_ACTION.RELEASED:
        return t('types.released');
      default:
        return type;
    }
  };

  const typeFilterOptions = useMemo(
    () => [
      {
        label: t('types.granted'),
        value: LOG_ACTION.GRANTED,
      },
      {
        label: t('types.consumed'),
        value: LOG_ACTION.CONSUMED,
      },
      {
        label: t('types.expired'),
        value: LOG_ACTION.EXPIRED,
      },
      {
        label: t('types.refunded'),
        value: LOG_ACTION.REFUNDED,
      },
      {
        label: t('types.held'),
        value: LOG_ACTION.HELD,
      },
      {
        label: t('types.released'),
        value: LOG_ACTION.RELEASED,
      },
    ],
    [t]
  );

  // Table columns definition
  const columns: ColumnDef<CreditTransaction>[] = useMemo(
    () => [
      {
        id: 'type',
        accessorKey: 'type',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label={t('columns.type')} />
        ),
        cell: ({ row }) => {
          const transaction = row.original;
          return (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="hover:bg-accent transition-colors"
              >
                {getTransactionTypeIcon(transaction.type)}
                {getTransactionTypeDisplayName(transaction.type)}
              </Badge>
            </div>
          );
        },
        meta: {
          label: t('columns.type'),
        },
        minSize: 140,
        size: 160,
      },
      {
        id: 'amount',
        accessorKey: 'amount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label={t('columns.amount')} />
        ),
        cell: ({ row }) => {
          const transaction = row.original;
          return <CreditDetailViewer transaction={transaction} />;
        },
        meta: {
          label: t('columns.amount'),
        },
        minSize: 100,
        size: 120,
      },
      {
        id: 'balance',
        accessorKey: 'balance',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label={t('columns.balance')} />
        ),
        cell: ({ row }) => {
          const transaction = row.original;
          return (
            <div className="flex items-center gap-2">
              {transaction.balance !== null ? (
                <span className="font-medium">
                  {transaction.balance.toLocaleString()}
                </span>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
          );
        },
        meta: {
          label: t('columns.balance'),
        },
        minSize: 120,
        size: 140,
      },
      {
        id: 'description',
        accessorKey: 'description',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={t('columns.description')}
          />
        ),
        cell: ({ row }) => {
          const transaction = row.original;
          return (
            <div className="flex items-center gap-2">
              {transaction.description ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="max-w-[200px] truncate cursor-help">
                        {transaction.description}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs whitespace-pre-wrap">
                        {transaction.description}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
          );
        },
        meta: {
          label: t('columns.description'),
        },
        minSize: 140,
        size: 160,
      },
      {
        id: 'paymentId',
        accessorKey: 'paymentId',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={t('columns.paymentId')}
          />
        ),
        cell: ({ row }) => {
          const transaction = row.original;
          return (
            <div className="flex items-center gap-2">
              {transaction.paymentId ? (
                <Badge
                  variant="outline"
                  className="text-sm px-1.5 cursor-pointer hover:bg-accent max-w-[150px]"
                  onClick={() => {
                    navigator.clipboard.writeText(transaction.paymentId!);
                    toast.success(t('paymentIdCopied'));
                  }}
                >
                  <span className="truncate">{transaction.paymentId}</span>
                </Badge>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
          );
        },
        meta: {
          label: t('columns.paymentId'),
        },
        minSize: 120,
        size: 140,
      },
      {
        id: 'expirationDate',
        accessorKey: 'expirationDate',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={t('columns.expirationDate')}
          />
        ),
        cell: ({ row }) => {
          const transaction = row.original;
          return (
            <div className="flex items-center gap-2">
              {transaction.expirationDate ? (
                <span className="text-sm">
                  {formatDate(transaction.expirationDate)}
                </span>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
          );
        },
        meta: {
          label: t('columns.expirationDate'),
        },
        minSize: 140,
        size: 160,
      },
      {
        id: 'expiredAt',
        accessorKey: 'expiredAt',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={t('columns.expiredAt')}
          />
        ),
        cell: ({ row }) => {
          const transaction = row.original;
          return (
            <div className="flex items-center gap-2">
              {transaction.expiredAt ? (
                <span className="text-sm">
                  {formatDate(transaction.expiredAt)}
                </span>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
          );
        },
        meta: {
          label: t('columns.expiredAt'),
        },
        minSize: 160,
        size: 180,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={t('columns.createdAt')}
          />
        ),
        cell: ({ row }) => {
          const transaction = row.original;
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {formatDate(transaction.createdAt)}
              </span>
            </div>
          );
        },
        meta: {
          label: t('columns.createdAt'),
        },
        minSize: 140,
        size: 160,
      },
      {
        id: 'updatedAt',
        accessorKey: 'updatedAt',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={t('columns.updatedAt')}
          />
        ),
        cell: ({ row }) => {
          const transaction = row.original;
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {formatDate(transaction.updatedAt)}
              </span>
            </div>
          );
        },
        meta: {
          label: t('columns.updatedAt'),
        },
        minSize: 140,
        size: 160,
      },
    ],
    [t, getTransactionTypeIcon, getTransactionTypeDisplayName]
  );

  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(total / pageSize),
    state: {
      sorting,
      columnFilters: filters ?? [],
      columnVisibility,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      onSortingChange?.(next);
    },
    onColumnFiltersChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(filters ?? []) : updater;
      onFiltersChange?.(next);
      onPageChange(0);
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize })
          : updater;
      if (next.pageSize !== pageSize) {
        onPageSizeChange(next.pageSize);
        if (pageIndex !== 0) onPageChange(0);
      } else if (next.pageIndex !== pageIndex) {
        onPageChange(next.pageIndex);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableMultiSort: false,
  });

  return (
    <div className="w-full space-y-4">
      <div>
        <DataTableAdvancedToolbar table={table}>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative">
              <Input
                placeholder={t('search')}
                value={search}
                onChange={(event) => {
                  onSearch(event.target.value);
                  onPageChange(0);
                }}
                className="h-8 w-[260px] pr-8"
              />
              {search.length > 0 ? (
                <button
                  type="button"
                  aria-label={t('clearSearch')}
                  className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => {
                    onSearch('');
                    onPageChange(0);
                  }}
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <DataTableFacetedFilter
              column={table.getColumn('type')}
              title={t('columns.type')}
              options={typeFilterOptions}
            />
          </div>
        </DataTableAdvancedToolbar>
      </div>
      <div className="relative flex flex-col gap-4 overflow-auto">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                // show skeleton rows while loading
                Array.from({ length: pageSize }).map((_, index) => (
                  <TableRowSkeleton key={index} columns={columns.length} />
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="h-14"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {t('noResults')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination table={table} className="px-0" />
      </div>
    </div>
  );
}
