import type { TargetSchema } from "@manifest/core";
export const sourceSchema = {
  name: "legacy_crm.customers",
  fields: [
    ["cust_id", "Legacy customer identifier"],
    ["full_name", "Customer name, sometimes Last, First"],
    ["email_addr", "Unnormalized email address"],
    ["phone", "Local or international phone"],
    ["signup_dt", "Mixed date formats"],
    ["status_cd", "A, I, S and undocumented X"],
    ["country", "Country names and aliases"],
    ["credit_limit", "Currency formatted credit limit"],
    ["vip_flag", "Y / N membership"],
    ["birth_date", "Optional date of birth"],
    ["zip", "Postal code"],
    ["notes", "Free text history"],
    ["last_login_ip", "Legacy login IP, personal data"],
  ].map(([name, description]) => ({ name: name!, description: description! })),
};
export const targetSchema: TargetSchema = {
  name: "target.customers",
  fields: [
    {
      name: "legacy_id",
      type: "string",
      required: true,
      unique: true,
      maxLength: 100,
    },
    { name: "first_name", type: "string", required: true, maxLength: 100 },
    { name: "last_name", type: "string", required: false, maxLength: 100 },
    {
      name: "email",
      type: "string",
      required: true,
      unique: true,
      format: "email",
      maxLength: 254,
    },
    { name: "phone_e164", type: "string", required: false, format: "phone" },
    {
      name: "status",
      type: "enum",
      required: true,
      enum: ["active", "inactive", "suspended"],
    },
    { name: "tier", type: "enum", required: true, enum: ["standard", "vip"] },
    { name: "country_code", type: "string", required: true, format: "country" },
    { name: "postal_code", type: "string", required: false, maxLength: 12 },
    { name: "credit_limit_cents", type: "integer", required: true, min: 0 },
    {
      name: "date_of_birth",
      type: "date",
      required: false,
      notAfterAsOfDate: true,
    },
    { name: "created_at", type: "timestamp", required: true },
    { name: "marketing_opt_in", type: "boolean", required: true },
  ],
};
export const PLANTED = {
  invalidEmail: 17,
  garbageSignupDate: 30,
  ambiguousDate: 42,
  undocumentedStatus: 88,
  duplicateEmailPair: [20, 21],
  duplicateCustId: [70, 71],
  targetConflicts: [10, 11, 12],
  multiDefect: 99,
};
export function generateSample() {
  const names = [
    "Asha Verma",
    "Rohan Shah",
    "Maria de la Cruz",
    "James Miller",
    "Priya Nair",
    "Elena Fischer",
    "Sam Chen",
    "Prince",
    "de la Cruz, Maria",
    "Noah Wilson",
  ];
  const rows = Array.from({ length: 250 }, (_, rowIndex) => ({
    rowIndex,
    payload: {
      cust_id: `C-${String(rowIndex + 1).padStart(6, "0")}`,
      full_name: names[rowIndex % names.length]!,
      email_addr: ` Customer.${rowIndex + 1}@Example.com `,
      phone: "+91 98765 43210",
      signup_dt:
        rowIndex % 3 === 0
          ? "14 Mar 2021"
          : rowIndex % 3 === 1
            ? "03/14/2021"
            : "2021-03-14",
      status_cd: ["A", "I", "S"][rowIndex % 3]!,
      country: ["India", "USA", "Deutschland", "UK"][rowIndex % 4]!,
      credit_limit: `$${100 + rowIndex}.50`,
      vip_flag: rowIndex % 5 === 0 ? "Y" : "N",
      birth_date: rowIndex % 4 === 0 ? "" : "1990-07-21",
      zip: "560001",
      notes: `Legacy note ${rowIndex + 1}`,
      last_login_ip: "10.2.3.4",
    },
  }));
  const set = (
    i: number,
    field: keyof (typeof rows)[number]["payload"],
    value: string,
  ) => {
    rows[i]!.payload[field] = value;
  };
  for (const i of [17, 18, 19, 22, 23, 24])
    set(i, "email_addr", "asha@@example");
  for (const i of [21, 26, 28, 32])
    set(i, "email_addr", rows[i - 1]!.payload.email_addr);
  for (const i of [10, 11, 12])
    set(i, "email_addr", `existing.${i - 9}@example.com`);
  for (const i of [35, 36, 37, 38, 39]) set(i, "phone", "555-0134");
  for (const i of [30, 40, 41]) set(i, "signup_dt", "not-a-date");
  set(42, "signup_dt", "04/05/2021");
  set(88, "status_cd", "X");
  for (const i of [45, 46, 47, 48]) set(i, "country", "Atlantis");
  for (const i of [50, 51, 52]) set(i, "credit_limit", "-50");
  for (const i of [53, 54, 55]) set(i, "credit_limit", "N/A");
  for (const i of [60, 61]) set(i, "birth_date", "2099-01-01");
  set(71, "cust_id", rows[70]!.payload.cust_id);
  set(72, "cust_id", rows[73]!.payload.cust_id);
  set(75, "cust_id", "");
  set(99, "email_addr", "bad");
  set(99, "credit_limit", "-10");
  return rows;
}
export const sampleRecords = generateSample();
export const targetSeed = Array.from({ length: 20 }, (_, i) => ({
  legacy_id: null,
  first_name: "Existing",
  last_name: `Customer ${i + 1}`,
  email: `existing.${i + 1}@example.com`,
  phone_e164: null,
  status: "active",
  tier: "standard",
  country_code: "IN",
  postal_code: "560001",
  credit_limit_cents: 10000,
  date_of_birth: null,
  created_at: "2020-01-01T00:00:00.000Z",
  marketing_opt_in: false,
}));
export * from "./reference-plan";
