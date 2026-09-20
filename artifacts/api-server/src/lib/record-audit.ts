type RecordData = Record<string, unknown>;
type RecordType = "qualityPlans" | "itps" | "inspections" | "ncrs" | "documents" | "audits";

type AuditContext = {
  projectId: string;
  actorUserId: string;
  recordType: RecordType;
  recordId: string;
};

function subjectFor(record: RecordData) {
  return String(record.title ?? record.name ?? record.number ?? record.reference ?? record.activity ?? record.id ?? "Record");
}

export function createdRecordAudit(context: AuditContext, after: RecordData) {
  return {
    ...context,
    action: "Created",
    subject: subjectFor(after),
    after,
  };
}

export function updatedRecordAudit(context: AuditContext, before: RecordData, after: RecordData) {
  return {
    ...context,
    action: "Updated",
    subject: subjectFor(after),
    before,
    after,
  };
}

export function deletedRecordAudit(context: AuditContext, before: RecordData) {
  return {
    ...context,
    action: "Deleted",
    subject: subjectFor(before),
    before,
  };
}