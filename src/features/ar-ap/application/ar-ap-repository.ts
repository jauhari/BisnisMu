import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { ApplyCreditNoteInput, Bill, CreateBillInput, CreateCustomerInput, CreateInvoiceInput, CreateVendorInput, Customer, Invoice, Payment, RecordPaymentInput, TenantContext, Vendor } from "../domain/ar-ap-types";
import type { TxClient } from "../../shared/tx";
export interface ArApAuditEvent { action:"CUSTOMER_CREATED"|"VENDOR_CREATED"|"INVOICE_DRAFTED"|"INVOICE_POSTED"|"BILL_DRAFTED"|"BILL_POSTED"|"PAYMENT_RECORDED"|"CREDIT_NOTE_APPLIED"|"DEBIT_NOTE_APPLIED"; businessId:string; actorUserId:string; entityType:"customer"|"vendor"|"invoice"|"bill"|"payment"|"adjustment_note"; entityId?:string; metadata:Record<string,unknown>; }
export interface ArApRepository {
  findAccount(ctx:TenantContext,id:string):Promise<AccountSnapshot|null>;
  createCustomer(ctx:TenantContext,input:CreateCustomerInput):Promise<Customer>; createVendor(ctx:TenantContext,input:CreateVendorInput):Promise<Vendor>;
  findCustomer(ctx:TenantContext,id:string):Promise<Customer|null>; findVendor(ctx:TenantContext,id:string):Promise<Vendor|null>;
  nextInvoiceNumber(ctx:TenantContext,date:Date):Promise<string>; nextBillNumber(ctx:TenantContext,date:Date):Promise<string>; nextPaymentNumber(ctx:TenantContext,date:Date):Promise<string>; nextNoteNumber(ctx:TenantContext,date:Date):Promise<string>;
  createInvoice(ctx:TenantContext,input:CreateInvoiceInput,number:string):Promise<Invoice>; createBill(ctx:TenantContext,input:CreateBillInput,number:string):Promise<Bill>;
  findInvoice(ctx:TenantContext,id:string):Promise<Invoice|null>; findBill(ctx:TenantContext,id:string):Promise<Bill|null>;
  markInvoicePosted(ctx:TenantContext,id:string,journalId:string,tx?:TxClient):Promise<Invoice>; markBillPosted(ctx:TenantContext,id:string,journalId:string,tx?:TxClient):Promise<Bill>;
  createPayment(ctx:TenantContext,input:RecordPaymentInput & { direction:"CUSTOMER_PAYMENT"|"VENDOR_PAYMENT"; paymentNumber:string; postedJournalId:string; customerId?:string|null; vendorId?:string|null },tx?:TxClient):Promise<Payment>;
  updateInvoicePaid(ctx:TenantContext,id:string,paidAmount:bigint,status:Invoice["status"],tx?:TxClient):Promise<Invoice>; updateBillPaid(ctx:TenantContext,id:string,paidAmount:bigint,status:Bill["status"],tx?:TxClient):Promise<Bill>;
  createCreditNote(ctx:TenantContext,input:ApplyCreditNoteInput & { noteNumber:string; postedJournalId:string; customerId:string },tx?:TxClient):Promise<void>;
  listInvoices(ctx:TenantContext):Promise<Invoice[]>; listBills(ctx:TenantContext):Promise<Bill[]>;
  createAuditLog(ctx:TenantContext,event:ArApAuditEvent):Promise<void>;
}
export interface Meta { actorUserId:string; requestId?:string; ipAddress?:string; userAgent?:string; }
export interface CreateCustomerCommand extends CreateCustomerInput, Meta {} export interface CreateVendorCommand extends CreateVendorInput, Meta {} export interface CreateInvoiceCommand extends CreateInvoiceInput, Meta {} export interface CreateBillCommand extends CreateBillInput, Meta {} export interface RecordPaymentCommand extends RecordPaymentInput, Meta {} export interface ApplyCreditNoteCommand extends ApplyCreditNoteInput, Meta {} export interface AgingCommand { businessId:string; asOf:Date; actorUserId:string; }

