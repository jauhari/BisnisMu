import { AccountSnapshot } from "../../accounting/domain/accounting-types";
export type DocumentStatus = "DRAFT" | "POSTED" | "PARTIALLY_PAID" | "PAID" | "VOID";
export type PaymentDirection = "CUSTOMER_PAYMENT" | "VENDOR_PAYMENT";
export interface TenantContext { businessId:string; actorUserId:string; requestId?:string; ipAddress?:string; userAgent?:string; }
export interface Customer { id:string; businessId:string; name:string; email?:string|null; phone?:string|null; address?:string|null; isActive:boolean; }
export interface Vendor { id:string; businessId:string; name:string; email?:string|null; phone?:string|null; address?:string|null; isActive:boolean; }
export interface Invoice { id:string; businessId:string; invoiceNumber:string; customerId:string; status:DocumentStatus; issueDate:Date; dueDate:Date; arAccountId:string; revenueAccountId:string; subtotal:bigint; paidAmount:bigint; description:string; postedJournalId?:string|null; }
export interface Bill { id:string; businessId:string; billNumber:string; vendorId:string; status:DocumentStatus; issueDate:Date; dueDate:Date; apAccountId:string; expenseAccountId:string; subtotal:bigint; paidAmount:bigint; description:string; postedJournalId?:string|null; }
export interface Payment { id:string; businessId:string; paymentNumber:string; direction:PaymentDirection; invoiceId?:string|null; billId?:string|null; paymentDate:Date; cashAccountId:string; amount:bigint; postedJournalId?:string|null; }
export interface CreateCustomerInput { businessId:string; name:string; email?:string; phone?:string; address?:string; }
export interface CreateVendorInput { businessId:string; name:string; email?:string; phone?:string; address?:string; }
export interface CreateInvoiceInput { businessId:string; customerId:string; issueDate:Date; dueDate:Date; arAccountId:string; revenueAccountId:string; subtotal:bigint; description:string; }
export interface CreateBillInput { businessId:string; vendorId:string; issueDate:Date; dueDate:Date; apAccountId:string; expenseAccountId:string; subtotal:bigint; description:string; }
export interface RecordPaymentInput { businessId:string; invoiceId?:string; billId?:string; paymentDate:Date; cashAccountId:string; amount:bigint; description:string; }
export interface ApplyCreditNoteInput { businessId:string; invoiceId:string; noteDate:Date; amount:bigint; description:string; }
export interface AgingBucket { current: bigint; days1To30: bigint; days31To60: bigint; days61To90: bigint; over90: bigint; }
export class ArApError extends Error { constructor(public readonly code:string,message:string,public readonly details?:Record<string,unknown>){super(message);this.name='ArApError'} }
export interface AccountValidationSet { cash?:AccountSnapshot|null; ar?:AccountSnapshot|null; ap?:AccountSnapshot|null; revenue?:AccountSnapshot|null; expense?:AccountSnapshot|null; }

