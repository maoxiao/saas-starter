import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { LOG_ACTION } from '@/credits/grant/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatDate } from '@/lib/formatter';
import {
  BanknoteIcon,
  ClockIcon,
  CoinsIcon,
  GiftIcon,
  HandCoinsIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

// Define the credit transaction interface (matching the one in the table)
export interface CreditTransaction {
  id: string;
  userId: string;
  type: string;
  description: string | null;
  amount: number;
  balance: number | null;
  paymentId: string | null;
  expirationDate: Date | null;
  expiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CreditDetailViewerProps {
  transaction: CreditTransaction;
}

export function CreditDetailViewer({ transaction }: CreditDetailViewerProps) {
  const t = useTranslations('Dashboard.settings.credits.transactions');
  const isMobile = useIsMobile();

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

  return (
    <Drawer direction={isMobile ? 'bottom' : 'right'}>
      <DrawerTrigger asChild>
        <Button
          variant="link"
          className="cursor-pointer text-foreground w-fit px-3 text-left h-auto"
        >
          <div className="flex items-center gap-2">
            <span
              className={`font-medium ${
                transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {transaction.amount > 0 ? '+' : ''}
              {transaction.amount.toLocaleString()}
            </span>
          </div>
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('detailViewer.title')}</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <div className="grid gap-4">
            <div className="flex items-center gap-2">
              {/* Transaction Type Badge */}
              <Badge
                variant="outline"
                className="hover:bg-accent transition-colors"
              >
                {getTransactionTypeIcon(transaction.type)}
                {getTransactionTypeDisplayName(transaction.type)}
              </Badge>
            </div>

            {/* Basic Information */}
            <div className="grid gap-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">
                  {t('columns.amount')}:
                </span>
                <span
                  className={`font-medium ${
                    transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {transaction.amount > 0 ? '+' : ''}
                  {transaction.amount.toLocaleString()}
                </span>
              </div>

              {transaction.balance !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    {t('columns.balance')}:
                  </span>
                  <span className="font-medium">
                    {transaction.balance.toLocaleString()}
                  </span>
                </div>
              )}

              {transaction.description && (
                <div className="grid gap-3">
                  <span className="text-muted-foreground text-xs">
                    {t('columns.description')}:
                  </span>
                  <span className="break-words">{transaction.description}</span>
                </div>
              )}

              {transaction.paymentId && (
                <div className="grid gap-3">
                  <span className="text-muted-foreground text-xs">
                    {t('columns.paymentId')}:
                  </span>
                  <span
                    className="font-mono text-sm cursor-pointer hover:bg-accent px-2 py-1 rounded border break-all"
                    onClick={() => {
                      navigator.clipboard.writeText(transaction.paymentId!);
                      toast.success(t('paymentIdCopied'));
                    }}
                  >
                    {transaction.paymentId}
                  </span>
                </div>
              )}

              {transaction.expirationDate && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    {t('columns.expirationDate')}:
                  </span>
                  <span>{formatDate(transaction.expirationDate)}</span>
                </div>
              )}

              {transaction.expiredAt && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    {t('columns.expiredAt')}:
                  </span>
                  <span>{formatDate(transaction.expiredAt)}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Timestamps */}
          <div className="grid gap-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">
                {t('columns.createdAt')}:
              </span>
              <span>{formatDate(transaction.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">
                {t('columns.updatedAt')}:
              </span>
              <span>{formatDate(transaction.updatedAt)}</span>
            </div>
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline" className="cursor-pointer">
              {t('detailViewer.close')}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
