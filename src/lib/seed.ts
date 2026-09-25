// Seed module — creates two tenants with isolated data and hashed passwords.
// Idempotent: short-circuits if any tenant already exists.
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const NOW = Date.now();
const days = (n: number) => new Date(NOW - n * 86400000);
const future = (n: number) => new Date(NOW + n * 86400000);
const PASSWORD = "password123";

// --- Block content builders -------------------------------------------------
type B = unknown;
const h = (level: 1 | 2 | 3, text: string): B => ({ type: "heading", level, text });
const p = (text: string): B => ({ type: "paragraph", text });
const callout = (variant: "info" | "warning" | "success" | "danger", text: string, title?: string): B => ({ type: "callout", variant, text, title });
const steps = (...items: string[]): B => ({ type: "steps", items });
const checklist = (...items: [string, boolean][]): B => ({ type: "checklist", items: items.map(([text, checked]) => ({ text, checked })) });
const table = (headers: string[], ...rows: string[][]): B => ({ type: "table", headers, rows });
const def = (term: string, definition: string): B => ({ type: "definition", term, definition });
const divider = (): B => ({ type: "divider" });
const j = (blocks: B[]) => JSON.stringify(blocks);

// ===========================================================================
// TENANT 1 — Atelier Corp (the rich demo dataset, 6 departments)
// ===========================================================================
const T1 = {
  slug: "atelier",
  name: "Atelier Corp",
  departments: [
    { name: "Human Resources", slug: "hr", icon: "Users", color: "#be185d", description: "People operations, talent, and workplace policies.", sortOrder: 0 },
    { name: "Operations", slug: "operations", icon: "Settings2", color: "#0d9488", description: "Day-to-day operational procedures and runbooks.", sortOrder: 1 },
    { name: "Information Technology", slug: "it", icon: "Server", color: "#7c3aed", description: "IT service management, security, and infrastructure.", sortOrder: 2 },
    { name: "Legal & Compliance", slug: "legal-compliance", icon: "Scale", color: "#475569", description: "Regulatory compliance, privacy, and legal affairs.", sortOrder: 3 },
    { name: "Finance", slug: "finance", icon: "Landmark", color: "#ca8a04", description: "Accounting, treasury, and financial controls.", sortOrder: 4 },
    { name: "Workforce Management", slug: "wfm", icon: "CalendarClock", color: "#db2777", description: "Scheduling, forecasting, and capacity planning.", sortOrder: 5 },
  ],
  users: [
    { name: "Elena Marchetti", email: "elena.marchetti@procedurehub.io", role: "OWNER", title: "HR Operations Lead", avatarColor: "#be185d", deptSlug: "hr" },
    { name: "Marco Rossi", email: "marco.rossi@procedurehub.io", role: "ADMIN", title: "Operations Director", avatarColor: "#0d9488", deptSlug: "operations" },
    { name: "Sofia Bianchi", email: "sofia.bianchi@procedurehub.io", role: "COMPLIANCE", title: "Compliance Officer", avatarColor: "#475569", deptSlug: "legal-compliance" },
    { name: "Luca Ferrari", email: "luca.ferrari@procedurehub.io", role: "OWNER", title: "IT Service Manager", avatarColor: "#7c3aed", deptSlug: "it" },
    { name: "Giulia Conti", email: "giulia.conti@procedurehub.io", role: "EDITOR", title: "Finance Controller", avatarColor: "#ca8a04", deptSlug: "finance" },
    { name: "Davide Romano", email: "davide.romano@procedurehub.io", role: "EDITOR", title: "WFM Analyst", avatarColor: "#db2777", deptSlug: "wfm" },
    { name: "Chiara Greco", email: "chiara.greco@procedurehub.io", role: "VIEWER", title: "People Partner", avatarColor: "#9333ea", deptSlug: "hr" },
    { name: "Andrea Costa", email: "andrea.costa@procedurehub.io", role: "VIEWER", title: "Junior IT Analyst", avatarColor: "#6366f1", deptSlug: "it" },
  ],
  procs: [
    { code: "HR-PROC-001", title: "Employee Onboarding", summary: "End-to-end onboarding workflow for new hires, from offer acceptance to day-30 review.", deptSlug: "hr", processName: "Talent Lifecycle", status: "PUBLISHED" as const, criticality: "HIGH" as const, tags: ["onboarding", "lifecycle", "iso-9001"], ackRequired: true, readMinutes: 9, nextReviewAt: future(28), publishedAt: days(120), createdAt: days(180), updatedAt: days(12), ownerEmail: "elena.marchetti@procedurehub.io", content: j([h(1,"Purpose & Scope"),p("This procedure defines the standard steps to onboard a new employee into the organization. It applies to all permanent, contract, and temporary hires across every department."),callout("info","Onboarding starts the moment a candidate accepts the offer — not on day one. Pre-boarding tasks are time-critical.","Pre-boarding starts immediately"),h(2,"Pre-boarding (D-7 to D-1)"),steps("Send welcome email with first-day agenda, dress code, and parking info.","Create the employee record in the HRIS and assign an employee ID.","Request IT provisioning via the ITSM portal (laptop, accounts, access).","Assign a buddy and schedule 1:1s with the direct manager for week one.","Prepare physical workspace and access badge."),h(2,"Day One"),checklist(["Welcome meeting with HR (30 min)",true],["Workspace and badge handover",true],["IT setup verification (laptop, email, SSO)",true],["Review of employee handbook and code of conduct",false],["Lunch with the immediate team",false]),h(2,"First 30 Days"),p("The manager owns the 30-day check-in. The buddy owns informal daily check-ins for the first two weeks."),table(["Milestone","Owner","Deadline","Status"],["Role expectations documented","Manager","Day 7","Required"],["Tooling training complete","IT / Buddy","Day 14","Required"],["First deliverable shipped","Manager","Day 30","Recommended"]),divider(),h(2,"Compliance & Records"),def("Record retention","Onboarding records are retained for the duration of employment plus 7 years per local labor law."),callout("warning","Access reviews for new hires must be reconciled against the role-based access matrix within 14 days. Unreconciled access is a finding under SOC 2 CC6.1."),h(2,"Related Documents"),p("See IT-PROC-002 (Access Provisioning) and HR-PROC-002 (Offboarding) for the inverse workflow.")]) },
    { code: "HR-PROC-002", title: "Employee Offboarding", summary: "Revocation of access, asset recovery, and knowledge transfer when an employee leaves.", deptSlug: "hr", processName: "Talent Lifecycle", status: "PUBLISHED" as const, criticality: "CRITICAL" as const, tags: ["offboarding", "access-control", "soc2"], ackRequired: true, readMinutes: 7, nextReviewAt: future(10), publishedAt: days(95), createdAt: days(180), updatedAt: days(8), ownerEmail: "elena.marchetti@procedurehub.io", content: j([h(1,"Purpose"),p("Ensure a controlled, complete, and auditable exit for every departing employee. Offboarding failures are a leading cause of unauthorized access incidents."),callout("danger","All access — physical and digital — must be revoked by the end of the last working day. Exceptions require written approval from the CISO and the employee's director."),h(2,"Trigger"),p("Offboarding is triggered by HR upon receipt of a resignation letter or a termination decision. HR opens the offboarding ticket within 4 business hours."),h(2,"Access Revocation Checklist"),checklist(["SSO / identity provider account disabled",false],["Email auto-reply configured + mailbox placed on litigation hold",false],["VPN and remote access revoked",false],["Source code repositories (GitHub/GitLab) access removed",false],["Cloud console access (AWS/GCP/Azure) removed",false],["SaaS applications reviewed and deprovisioned",false],["Physical badge and keys returned",false],["Hardware assets returned and reconciled",false]),h(2,"Knowledge Transfer"),steps("Manager identifies critical responsibilities and undocumented knowledge.","Departing employee documents handovers in the knowledge base.","Manager reassigns ownership of open projects and tickets.","Final handover meeting scheduled before last day."),h(2,"Exit Interview"),p("Conducted by HR, not the direct manager. Feedback is anonymized and aggregated quarterly.")]) },
    { code: "HR-PROC-003", title: "Performance Review Cycle", summary: "Semi-annual performance review and calibration process for all employees.", deptSlug: "hr", processName: "Talent Lifecycle", status: "IN_REVIEW" as const, criticality: "MEDIUM" as const, tags: ["performance", "review-cycle"], ackRequired: false, readMinutes: 6, nextReviewAt: future(60), publishedAt: null, createdAt: days(40), updatedAt: days(2), ownerEmail: "elena.marchetti@procedurehub.io", content: j([h(1,"Performance Review Cycle"),p("Semi-annual review covering the periods January–June and July–December. Calibration ensures fairness across teams before ratings are finalized."),callout("warning","This procedure is under compliance review. The calibration step requires an updated rating rubric aligned to the new competency framework."),h(2,"Timeline"),table(["Phase","Window","Owner"],["Self-assessment","Week 1–2","Employee"],["Manager assessment","Week 3","Manager"],["Calibration","Week 4","Department head"],["Feedback delivered","Week 5","Manager → Employee"]),h(2,"Calibration Rules"),steps("Department head convenes calibration with all people managers.","Each rating is justified against the rubric with specific evidence.","Distribution is reviewed against the forced curve guideline (±5%).","Final ratings locked and published to HRIS.")]) },
    { code: "HR-WI-001", title: "Creating an Employee Record in the HRIS", summary: "Work instruction for HR admins on creating a complete, compliant employee record.", deptSlug: "hr", processName: "Talent Lifecycle", status: "PUBLISHED" as const, criticality: "MEDIUM" as const, tags: ["work-instruction", "hris"], ackRequired: false, readMinutes: 4, nextReviewAt: future(120), publishedAt: days(60), createdAt: days(90), updatedAt: days(30), ownerEmail: "elena.marchetti@procedurehub.io", parentIdCode: "HR-PROC-001", content: j([h(1,"Creating an Employee Record"),p("This work instruction supports HR-PROC-001 (Employee Onboarding). It describes the exact HRIS steps."),steps("Open HRIS → People → Add Employee.","Enter legal name exactly as it appears on the identity document.","Set the contract type, start date, and probation end date.","Assign the cost center and reporting manager.","Upload the signed contract to the documents tab.","Save as 'Draft' and submit for HR Lead approval."),callout("info","Records left in 'Draft' for more than 48h are flagged in the daily exception report.")]) },
    { code: "OPS-PROC-001", title: "Incident Response & Escalation", summary: "Classification, response, and escalation of operational incidents (P1–P4).", deptSlug: "operations", processName: "Service Management", status: "PUBLISHED" as const, criticality: "CRITICAL" as const, tags: ["incident", "escalation", "runbook"], ackRequired: true, readMinutes: 11, nextReviewAt: future(3), publishedAt: days(140), createdAt: days(200), updatedAt: days(4), ownerEmail: "marco.rossi@procedurehub.io", content: j([h(1,"Incident Response"),p("Defines how the operations team classifies, responds to, and resolves incidents affecting internal services or customer-facing platforms."),callout("danger","A P1 incident triggers the war-room protocol. The on-call director must be paged within 5 minutes of declaration.","P1 — page the director"),h(2,"Severity Matrix"),table(["Severity","Impact","Target response","Target resolution"],["P1","Critical — full outage / data loss","5 min","1 hour"],["P2","Major — partial outage","15 min","4 hours"],["P3","Minor — degraded, workaround exists","1 hour","1 business day"],["P4","Low — cosmetic / non-urgent","1 business day","Next sprint"]),h(2,"Response Steps"),steps("Acknowledge the alert and create an incident ticket.","Assign a severity and appoint an Incident Commander.","Open the war-room channel and post the initial situation report.","Communicate status to stakeholders every 30 min (P1/P2).","Resolve, verify recovery, and close the incident.","Schedule a blameless postmortem within 3 business days."),h(2,"Escalation Path"),checklist(["Incident Commander can escalate to on-call SRE any time",true],["Director paged only for P1 or unresolved P2 > 2h",true],["Customer comms drafted by Customer Success, approved by Director",false])]) },
    { code: "OPS-PROC-002", title: "Change Management", summary: "Change request lifecycle: submission, CAB review, approval, and deployment windows.", deptSlug: "operations", processName: "Service Management", status: "PUBLISHED" as const, criticality: "HIGH" as const, tags: ["change", "cab", "itil"], ackRequired: true, readMinutes: 8, nextReviewAt: future(45), publishedAt: days(110), createdAt: days(200), updatedAt: days(20), ownerEmail: "marco.rossi@procedurehub.io", content: j([h(1,"Change Management"),p("Every change to production — code, config, or infrastructure — passes through this procedure. Emergency changes follow a fast-track but are still logged and reviewed."),h(2,"Change Types"),table(["Type","CAB review","Notice","Rollback plan"],["Standard","No (pre-approved)","None","Documented"],["Normal","Yes","5 business days","Required"],["Emergency","Post-implementation","Verbal","Required"]),callout("warning","Emergency changes must be retroactively reviewed at the next CAB meeting. Repeated emergency-only patterns indicate a process issue."),h(2,"Approval Workflow"),steps("Requester submits CR with impact analysis and test evidence.","Change Manager validates completeness and assigns risk tier.","CAB reviews Normal changes every Tuesday and Thursday.","Approved changes deploy only during the published window.","Post-implementation review within 48 hours.")]) },
    { code: "OPS-PROC-003", title: "Vendor Onboarding & Due Diligence", summary: "Security and financial due diligence before onboarding a new supplier.", deptSlug: "operations", processName: "Procurement", status: "DRAFT" as const, criticality: "MEDIUM" as const, tags: ["vendor", "procurement", "due-diligence"], ackRequired: false, readMinutes: 6, nextReviewAt: null, publishedAt: null, createdAt: days(15), updatedAt: days(1), ownerEmail: "marco.rossi@procedurehub.io", content: j([h(1,"Vendor Onboarding"),p("Draft procedure pending legal review. Defines the minimum due-diligence bar for any new supplier handling company or customer data."),callout("info","This is a draft. Sections marked TODO are pending input from Legal and Security."),h(2,"Minimum Requirements"),checklist(["Signed master service agreement",false],["Valid SOC 2 Type II or ISO 27001 certificate",false],["Data processing agreement (if PII is involved)",false],["Financial stability check (Dun & Bradstreet)",false],["Insurance certificates on file",false]),h(2,"TODO"),p("Add criticality tiering and the security questionnaire workflow.")]) },
    { code: "IT-PROC-001", title: "Access Provisioning & RBAC", summary: "Role-based access control model and the provisioning workflow for new and existing staff.", deptSlug: "it", processName: "Identity & Access", status: "PUBLISHED" as const, criticality: "CRITICAL" as const, tags: ["rbac", "iam", "soc2", "least-privilege"], ackRequired: true, readMinutes: 10, nextReviewAt: future(7), publishedAt: days(150), createdAt: days(220), updatedAt: days(5), ownerEmail: "luca.ferrari@procedurehub.io", content: j([h(1,"Access Provisioning"),p("All access is granted on a least-privilege, need-to-know basis via the role-based access control (RBAC) model. No standing admin access is permitted without a documented exception."),callout("danger","Shared accounts are prohibited. Every action must be attributable to a named identity."),h(2,"RBAC Model"),table(["Role","Systems","Approval"],["Standard User","Email, HRIS, Wiki","Auto (manager approval)"],["Power User","+ Reporting read","ITSM ticket"],["Administrator","Production systems","Director + CISO"],["Break-glass","Emergency only","Time-boxed, auto-logged"]),h(2,"Provisioning Workflow"),steps("Requester opens an access request in the ITSM portal, selecting the target role.","Direct manager approves (auto-approved for standard roles on hire).","IT executes the role template against the identity provider.","Access reconciled against role matrix within 14 days (SOC 2 CC6.1)."),h(2,"Quarterly Access Review"),p("Every quarter, system owners review all access to their systems. Orphaned or excessive access is revoked. The review is signed off and archived as audit evidence."),callout("warning","Access not reviewed within 30 days of the review window opening is auto-flagged to the CISO.")]) },
    { code: "IT-PROC-002", title: "Backup & Disaster Recovery", summary: "Backup strategy, retention, restore testing, and disaster recovery runbook.", deptSlug: "it", processName: "Infrastructure", status: "PUBLISHED" as const, criticality: "HIGH" as const, tags: ["backup", "dr", "resilience"], ackRequired: true, readMinutes: 8, nextReviewAt: future(75), publishedAt: days(100), createdAt: days(220), updatedAt: days(25), ownerEmail: "luca.ferrari@procedurehub.io", content: j([h(1,"Backup & DR"),p("Covers the 3-2-1 backup strategy, retention windows, and the quarterly disaster recovery exercise."),h(2,"Backup Strategy"),table(["Data class","Frequency","Retention","Off-site copy"],["Transactional DB","Hourly incremental + daily full","35 days","Yes"],["Object storage","Continuous versioning","90 days","Yes"],["Config & IaC","On commit","Indefinite (Git)","Yes (mirror)"]),callout("info","Restore tests run automatically every Sunday on a staging copy. Failures page the on-call SRE."),h(2,"DR Exercise"),steps("Declare a simulated region failure on the first Tuesday of the quarter.","Promote the DR region to primary within the RTO (4 hours).","Verify critical user journeys end-to-end.","Fail back and publish the exercise report to the risk register.")]) },
    { code: "IT-PROC-003", title: "Security Incident Handling", summary: "Detection, containment, eradication, and lessons-learned for security incidents.", deptSlug: "it", processName: "Security", status: "PUBLISHED" as const, criticality: "CRITICAL" as const, tags: ["security", "soc", "breach"], ackRequired: true, readMinutes: 9, nextReviewAt: future(5), publishedAt: days(130), createdAt: days(220), updatedAt: days(3), ownerEmail: "luca.ferrari@procedurehub.io", content: j([h(1,"Security Incident Handling"),p("Aligned to NIST SP 800-61. The SOC triages alerts 24/7; confirmed incidents follow the lifecycle below."),callout("danger","A confirmed data breach triggers the 72-hour regulatory notification clock. The DPO and Legal must be engaged immediately."),h(2,"Lifecycle"),steps("Detection — alert or report received by the SOC.","Triage — confirm severity and assign an Incident Owner.","Containment — isolate affected systems, preserve evidence.","Eradication — remove the threat and close the vector.","Recovery — restore service from known-good state.","Lessons learned — postmortem within 5 business days."),h(2,"Communication"),table(["Audience","Owner","Channel"],["Executive","CISO","Direct call"],["Regulator","DPO + Legal","Formal notice"],["Customers","CS + Comms","Status page + email"],["Internal","Incident Owner","War-room channel"])]) },
    { code: "LC-PROC-001", title: "GDPR Data Subject Request Handling", summary: "Intake, verification, and fulfilment of DSARs within the statutory one-month window.", deptSlug: "legal-compliance", processName: "Privacy", status: "PUBLISHED" as const, criticality: "HIGH" as const, tags: ["gdpr", "privacy", "dsar"], ackRequired: true, readMinutes: 7, nextReviewAt: future(15), publishedAt: days(80), createdAt: days(200), updatedAt: days(9), ownerEmail: "sofia.bianchi@procedurehub.io", content: j([h(1,"DSAR Handling"),p("Every individual has the right to access, rectify, erase, or port their personal data. This procedure ensures we fulfil requests within the GDPR one-month window."),callout("warning","The clock starts when the request is received — even if identity is not yet verified. Log the receipt date immediately."),h(2,"Intake"),steps("Log the request in the privacy register with a unique reference.","Send the identity verification template to the requester.","Verify identity; reject anonymous or unverifiable requests in writing.","Confirm scope with the requester (which data, which period)."),h(2,"Fulfilment Timeline"),table(["Day","Action"],["0","Request logged + verification sent"],["1–7","Identity verified, systems queried"],["8–21","Data compiled, redactions applied, legal review"],["22–28","Response delivered with audit trail"]),callout("info","A one-month extension is possible for complex requests, but the requester must be informed within the first month.")]) },
    { code: "LC-PROC-002", title: "Document Retention Policy", summary: "Retention windows and secure disposal for each document class across the organization.", deptSlug: "legal-compliance", processName: "Records", status: "PUBLISHED" as const, criticality: "HIGH" as const, tags: ["retention", "records", "gdpr"], ackRequired: true, readMinutes: 6, nextReviewAt: future(90), publishedAt: days(160), createdAt: days(240), updatedAt: days(40), ownerEmail: "sofia.bianchi@procedurehub.io", content: j([h(1,"Document Retention"),p("Defines how long each class of record is kept and how it is disposed of. Retention is enforced automatically where possible."),table(["Document class","Retention","Disposal"],["Employment records","Term + 7 years","Cross-cut shred / secure delete"],["Financial records","10 years","Secure delete"],["Tax filings","10 years","Secure delete"],["Customer contracts","Term + 5 years","Secure delete"],["Marketing consents","Until withdrawn + 3 years","Secure delete"]),callout("warning","Records under legal hold are exempt from retention disposal. The legal hold register overrides the schedule.")]) },
    { code: "LC-PROC-003", title: "ISO 27001 Internal Audit", summary: "Annual internal audit programme: scope, sampling, findings, and management review.", deptSlug: "legal-compliance", processName: "Audit", status: "PUBLISHED" as const, criticality: "HIGH" as const, tags: ["iso-27001", "audit", "isms"], ackRequired: true, readMinutes: 8, nextReviewAt: future(50), publishedAt: days(70), createdAt: days(200), updatedAt: days(15), ownerEmail: "sofia.bianchi@procedurehub.io", content: j([h(1,"Internal Audit Programme"),p("Covers the planning and execution of the internal ISMS audit, required annually by ISO/IEC 27001 clause 9.2."),h(2,"Annual Plan"),steps("Draft the audit plan covering all Annex A controls over the year.","Approve the plan in the management review.","Assign qualified internal auditors (independent of the area).","Execute audits per the quarterly schedule.","Track findings to closure in the corrective-action register."),h(2,"Finding Severity"),table(["Severity","Definition","Closure SLA"],["Major nonconformity","Control absent or ineffective","30 days"],["Minor nonconformity","Control gaps, isolated","90 days"],["Observation","Improvement opportunity","Next review"])]) },
    { code: "FIN-PROC-001", title: "Expense Reimbursement", summary: "Submission, approval, and reimbursement of employee expenses.", deptSlug: "finance", processName: "Accounts Payable", status: "PUBLISHED" as const, criticality: "LOW" as const, tags: ["expense", "reimbursement"], ackRequired: false, readMinutes: 5, nextReviewAt: future(100), publishedAt: days(90), createdAt: days(180), updatedAt: days(35), ownerEmail: "giulia.conti@procedurehub.io", content: j([h(1,"Expense Reimbursement"),p("Employees submit expenses within 30 days of incurring them. Approval follows the delegated authority matrix."),callout("info","Receipts are mandatory for any expense over €15. Missing receipts require a written justification."),h(2,"Approval Matrix"),table(["Amount","Approver"],["< €250","Direct manager"],["€250–€2,500","Manager + cost center owner"],["> €2,500","Manager + Finance Director"]),h(2,"Steps"),steps("Submit expense in the expense tool with itemized lines and receipts.","Manager approves within 3 business days.","Finance audits and schedules payment.","Reimbursement lands in the next payroll cycle.")]) },
    { code: "FIN-PROC-002", title: "Month-End Close", summary: "Month-end financial close checklist, ownership, and cut-off controls.", deptSlug: "finance", processName: "Close", status: "PUBLISHED" as const, criticality: "HIGH" as const, tags: ["close", "accounting", "controls"], ackRequired: true, readMinutes: 8, nextReviewAt: future(20), publishedAt: days(85), createdAt: days(200), updatedAt: days(18), ownerEmail: "giulia.conti@procedurehub.io", content: j([h(1,"Month-End Close"),p("The close calendar runs from working day −2 (pre-close) to working day +5 (sign-off). Each step has a named owner and a hard deadline."),callout("warning","Late close steps delay the board pack. Any slip must be escalated to the Finance Director before the deadline passes."),h(2,"Close Checklist"),table(["Day","Task","Owner"],["WD-2","Accruals and prepayments posted","GL Accountant"],["WD-1","Bank reconciliations complete","Treasury"],["WD+1","Intercompany matched","Controllers"],["WD+3","Management accounts draft","Controller"],["WD+5","Sign-off and board pack","Finance Director"]),h(2,"Cut-off Controls"),checklist(["No manual journals after WD+3 without FD approval",true],["All bank accounts reconciled to the penny",true],["Revenue recognized per the five-step model",false])]) },
    { code: "WFM-PROC-001", title: "Shift Scheduling & Rostering", summary: "Forecasting, scheduling, and publishing shifts for frontline teams.", deptSlug: "wfm", processName: "Scheduling", status: "PUBLISHED" as const, criticality: "MEDIUM" as const, tags: ["scheduling", "roster", "forecast"], ackRequired: false, readMinutes: 6, nextReviewAt: future(40), publishedAt: days(60), createdAt: days(160), updatedAt: days(12), ownerEmail: "davide.romano@procedurehub.io", content: j([h(1,"Shift Scheduling"),p("Schedules are built on a 4-week rolling forecast. Published 2 weeks ahead. Changes within 7 days require employee consent."),h(2,"Forecast Inputs"),steps("Pull the historical volume by interval from the WFM tool.","Apply seasonality and known event adjustments.","Convert to FTE requirement using the AHT and shrinkage model.","Generate the draft shift pattern and coverage map."),h(2,"Coverage Rules"),table(["Metric","Target"],["Schedule adherence","≥ 92%"],["Forecast accuracy (MAPE)","≤ 8%"],["Shrinkage allowance","30%"])]) },
    { code: "WFM-PROC-002", title: "Time-off Approval Workflow", summary: "How time-off requests are submitted, balanced, and approved.", deptSlug: "wfm", processName: "Absence", status: "PUBLISHED" as const, criticality: "LOW" as const, tags: ["absence", "pto"], ackRequired: false, readMinutes: 4, nextReviewAt: future(140), publishedAt: days(55), createdAt: days(150), updatedAt: days(22), ownerEmail: "davide.romano@procedurehub.io", content: j([h(1,"Time-off Approval"),p("Employees request time off at least 14 days in advance (7 days for single days). Approvals respect team coverage and the first-come-first-served rule."),callout("info","Conflicts are auto-flagged. If two requests collide, the one submitted earlier is prioritized."),h(2,"Approval Steps"),steps("Employee submits the request with the dates and category.","System checks the balance and team coverage.","Manager approves or declines within 2 business days.","Approved time-off is published to the shared team calendar.")]) },
    { code: "LC-PROC-004", title: "Whistleblowing Intake & Investigation", summary: "Confidential intake and investigation of whistleblower reports per EU Directive 2019/1937.", deptSlug: "legal-compliance", processName: "Ethics", status: "ARCHIVED" as const, criticality: "CRITICAL" as const, tags: ["whistleblowing", "ethics", "archived"], ackRequired: false, readMinutes: 6, nextReviewAt: null, publishedAt: days(300), createdAt: days(400), updatedAt: days(200), ownerEmail: "sofia.bianchi@procedurehub.io", content: j([h(1,"Whistleblowing (Archived)"),callout("info","This procedure has been archived and superseded by LC-PROC-005, which reflects the new external reporting channel."),p("Retained for historical reference only. Do not use for active intake.")]) },
    { code: "HR-PROC-004", title: "Remote Work Policy", summary: "Eligibility, equipment, and expectations for hybrid and remote work arrangements.", deptSlug: "hr", processName: "Workplace", status: "IN_REVIEW" as const, criticality: "MEDIUM" as const, tags: ["remote", "policy", "workplace"], ackRequired: false, readMinutes: 5, nextReviewAt: future(30), publishedAt: null, createdAt: days(20), updatedAt: days(1), ownerEmail: "elena.marchetti@procedurehub.io", content: j([h(1,"Remote Work Policy"),p("Under review. Clarifies eligibility, home-office equipment, and the expected split between office and remote days."),callout("warning","Pending input from IT on the home-office equipment stipend and from Finance on the tax treatment."),h(2,"Draft Eligibility"),checklist(["Role is eligible for hybrid (manager confirms)",false],["Employee past probation",false],["Home workspace meets the ergonomic minimum",false])]) },
  ],
};

// ===========================================================================
// TENANT 2 — Northwind Logistics (smaller, demonstrates isolation)
// ===========================================================================
const T2 = {
  slug: "northwind",
  name: "Northwind Logistics",
  departments: [
    { name: "Warehouse Operations", slug: "warehouse", icon: "Settings2", color: "#0891b2", description: "Warehouse, fulfilment, and inventory procedures.", sortOrder: 0 },
    { name: "Fleet & Transport", slug: "fleet", icon: "Server", color: "#ea580c", description: "Fleet management, driver safety, and transport compliance.", sortOrder: 1 },
  ],
  users: [
    { name: "Nora Lindqvist", email: "nora.lindqvist@northwind.io", role: "ADMIN", title: "Warehouse Manager", avatarColor: "#0891b2", deptSlug: "warehouse" },
    { name: "Tomas Berg", email: "tomas.berg@northwind.io", role: "OWNER", title: "Fleet & Safety Lead", avatarColor: "#ea580c", deptSlug: "fleet" },
  ],
  procs: [
    { code: "WH-PROC-001", title: "Inbound Receiving & Putaway", summary: "Receiving, inspection, and putaway of inbound shipments at the distribution centre.", deptSlug: "warehouse", processName: "Inbound", status: "PUBLISHED" as const, criticality: "HIGH" as const, tags: ["warehouse", "inbound", "inventory"], ackRequired: true, readMinutes: 7, nextReviewAt: future(18), publishedAt: days(70), createdAt: days(150), updatedAt: days(6), ownerEmail: "nora.lindqvist@northwind.io", content: j([h(1,"Inbound Receiving"),p("Every inbound shipment is checked against the ASN before putaway. Discrepancies are quarantined and reported within 2 hours."),callout("warning","Do not put away any pallet with a broken seal or missing ASN. Move it to the quarantine zone and notify the shift supervisor."),h(2,"Receiving Steps"),steps("Match the delivery to the advanced shipping notice (ASN).","Count pallets and verify seal integrity.","Inspect for visible damage; photograph any exceptions.","Scan each pallet into the WMS against the expected SKU list.","Stage for putaway in the designated zone."),h(2,"Discrepancy Handling"),table(["Discrepancy","Action"],["Short shipment","Log in WMS, notify procurement"],["Over-shipment","Hold excess in quarantine, await disposition"],["Damaged goods","Photograph, quarantine, raise claim"],["Wrong SKU","Do not put away; flag for returns"])]) },
    { code: "FL-PROC-001", title: "Driver Vehicle Checks & Pre-Trip Inspection", summary: "Mandatory daily vehicle walk-around check and defect reporting for all commercial drivers.", deptSlug: "fleet", processName: "Driver Compliance", status: "PUBLISHED" as const, criticality: "CRITICAL" as const, tags: ["fleet", "driver-safety", "compliance"], ackRequired: true, readMinutes: 6, nextReviewAt: future(8), publishedAt: days(60), createdAt: days(140), updatedAt: days(4), ownerEmail: "tomas.berg@northwind.io", content: j([h(1,"Pre-Trip Vehicle Check"),p("Every commercial driver completes a documented walk-around check before departing the yard. No vehicle leaves without a signed check."),callout("danger","Any defect marked 'Dangerous' or 'Major' (red) means the vehicle does not move. Call the fleet desk for a replacement."),h(2,"Walk-Around Checklist"),checklist(["Tyres — pressure and tread depth",true],["Lights — all functions including indicators and brake lights",true],["Brakes — service and parking",true],["Mirrors and windscreen — clean and intact",true],["Load security — straps, curtains, tail-lift",true],["Tachograph — fitted and functioning",true],["Fuel / charge level — sufficient for the route",false]),h(2,"Defect Classification"),table(["Class","Example","Action"],["Minor","Stone chip in mirror","Report, continue"],["Major","Worn tyre near limit","Report, depot before next trip"],["Dangerous","Brake defect","Stop. Do not move. Call fleet desk"])]) },
    { code: "WH-PROC-002", title: "Cycle Counting & Inventory Accuracy", summary: "Daily cycle-count programme to maintain ≥ 99.5% inventory accuracy.", deptSlug: "warehouse", processName: "Inventory Control", status: "IN_REVIEW" as const, criticality: "MEDIUM" as const, tags: ["inventory", "cycle-count"], ackRequired: false, readMinutes: 5, nextReviewAt: future(45), publishedAt: null, createdAt: days(20), updatedAt: days(2), ownerEmail: "nora.lindqvist@northwind.io", content: j([h(1,"Cycle Counting"),p("Under review for the new ABC classification. Defines the daily count cadence and the variance investigation workflow."),callout("info","Draft pending the updated ABC tiers from the inventory analyst.")]) },
  ],
};

// ===========================================================================
// Seed runner
// ===========================================================================
export async function ensureSeed() {
  if ((await db.tenant.count()) > 0) return;

  for (const t of [T1, T2]) {
    await seedTenant(t);
  }
}

async function seedTenant(t: typeof T1) {
  const tenant = await db.tenant.create({ data: { name: t.name, slug: t.slug } });

  const deptMap = new Map<string, string>();
  for (const d of t.departments) {
    const created = await db.department.create({
      data: {
        tenantId: tenant.id,
        name: d.name, slug: d.slug, icon: d.icon, color: d.color,
        description: d.description, sortOrder: d.sortOrder,
      },
    });
    deptMap.set(d.slug, created.id);
  }

  // processes (derived)
  const procByDept = new Map<string, Set<string>>();
  for (const proc of t.procs) {
    if (!procByDept.has(proc.deptSlug)) procByDept.set(proc.deptSlug, new Set());
    procByDept.get(proc.deptSlug)!.add(proc.processName);
  }
  const processIdMap = new Map<string, string>();
  for (const [deptSlug, names] of procByDept) {
    let order = 0;
    for (const name of names) {
      const created = await db.process.create({
        data: { name, sortOrder: order++, departmentId: deptMap.get(deptSlug)! },
      });
      processIdMap.set(`${deptSlug}:${name}`, created.id);
    }
  }

  // users
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const userIdMap = new Map<string, string>();
  for (const u of t.users) {
    const created = await db.user.create({
      data: {
        tenantId: tenant.id,
        name: u.name, email: u.email, passwordHash,
        role: u.role, title: u.title, avatarColor: u.avatarColor,
        departmentId: u.deptSlug ? deptMap.get(u.deptSlug)! : null,
      },
    });
    userIdMap.set(u.email, created.id);
  }

  // procedures (two passes for parent links)
  const procIdByCode = new Map<string, string>();
  for (const proc of t.procs) {
    const created = await db.procedure.create({
      data: {
        tenantId: tenant.id,
        code: proc.code, title: proc.title, summary: proc.summary,
        departmentId: deptMap.get(proc.deptSlug)!,
        processId: processIdMap.get(`${proc.deptSlug}:${proc.processName}`)!,
        status: proc.status, criticality: proc.criticality,
        tags: JSON.stringify(proc.tags), content: proc.content,
        ackRequired: proc.ackRequired, readMinutes: proc.readMinutes,
        nextReviewAt: proc.nextReviewAt, publishedAt: proc.publishedAt,
        createdAt: proc.createdAt, updatedAt: proc.updatedAt,
        ownerId: userIdMap.get(proc.ownerEmail)!,
      },
    });
    procIdByCode.set(proc.code, created.id);
  }
  for (const proc of t.procs) {
    if (proc.parentIdCode) {
      await db.procedure.update({
        where: { id: procIdByCode.get(proc.code)! },
        data: { parentId: procIdByCode.get(proc.parentIdCode)! },
      });
    }
  }

  // Favorites + acks for the first user of each tenant
  const primaryUserId = userIdMap.get(t.users[0].email)!;
  const favCodes = t.procs.slice(0, 4).map((p) => p.code);
  for (const code of favCodes) {
    await db.favorite.create({
      data: { userId: primaryUserId, procedureId: procIdByCode.get(code)! },
    });
  }
  const ackCodes = t.procs.filter((p) => p.status === "PUBLISHED" && p.ackRequired).slice(0, 5).map((p) => p.code);
  for (const code of ackCodes) {
    const proc = await db.procedure.findUnique({ where: { id: procIdByCode.get(code)! } });
    if (proc) {
      await db.acknowledgment.create({
        data: { userId: primaryUserId, procedureId: proc.id, version: proc.version, acknowledgedAt: days(Math.floor(Math.random() * 30) + 1) },
      });
    }
  }

  // notifications for primary user
  const notifTemplates = [
    { type: "REVIEW_REQUEST", title: "Review requested", body: "A procedure needs your review.", code: t.procs.find((p) => p.status === "IN_REVIEW")?.code, daysAgo: 1 },
    { type: "ACK_DUE", title: "Acknowledgment due", body: "A published procedure was updated — please read & acknowledge.", code: t.procs.find((p) => p.status === "PUBLISHED")?.code, daysAgo: 3 },
    { type: "PUBLISHED", title: "New procedure published", body: "A procedure is now live and may require your acknowledgment.", code: t.procs.find((p) => p.status === "PUBLISHED")?.code, daysAgo: 5 },
  ] as const;
  for (const n of notifTemplates) {
    if (!n.code) continue;
    await db.notification.create({
      data: {
        userId: primaryUserId, type: n.type, title: n.title, body: n.body,
        procedureId: procIdByCode.get(n.code) ?? null,
        read: n.daysAgo > 4, createdAt: days(n.daysAgo),
      },
    });
  }

  // audit logs
  const auditActions = [
    { action: "UPDATE", code: t.procs[0].code, summary: "Updated content", email: t.users[0].email, daysAgo: 1 },
    { action: "PUBLISH", code: t.procs.find((p) => p.status === "PUBLISHED")?.code ?? t.procs[0].code, summary: "Published", email: t.users[0].email, daysAgo: 5 },
    { action: "ACK", code: ackCodes[0] ?? t.procs[0].code, summary: "Acknowledged", email: t.users[0].email, daysAgo: 6 },
    { action: "CREATE", code: t.procs[t.procs.length - 1].code, summary: "Created draft", email: t.users[0].email, daysAgo: 12 },
  ];
  for (const a of auditActions) {
    const procId = procIdByCode.get(a.code);
    if (!procId) continue;
    await db.auditLog.create({
      data: {
        tenantId: tenant.id,
        action: a.action, entityType: "PROCEDURE", entityId: procId,
        summary: a.summary, userId: userIdMap.get(a.email) ?? null,
        procedureId: procId, createdAt: days(a.daysAgo),
      },
    });
  }

  // announcements
  await db.announcement.createMany({
    data: [
      { tenantId: tenant.id, title: "Welcome to Procedure Hub", body: "Your operational procedure workspace is ready. Use ⌘K to search and navigate.", variant: "info", pinned: true, createdAt: days(2) },
      { tenantId: tenant.id, title: "Quarterly review window", body: "Procedures with reviews due this quarter are flagged on your dashboard.", variant: "warning", pinned: false, createdAt: days(6) },
    ],
  });
}

export const DEMO_CREDENTIALS = { password: PASSWORD };
