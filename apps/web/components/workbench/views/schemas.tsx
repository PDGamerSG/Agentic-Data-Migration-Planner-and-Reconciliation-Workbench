"use client";
import { useState } from "react";
import { useWorkbench } from "../context";
import { Pager, Sheet, fmt } from "../ui";

export function Schemas() {
  const { state } = useWorkbench();
  const [profile, setProfile] = useState("email_addr");
  const [page, setPage] = useState(0);
  const records = state.dataset.records;
  const values = records.map((r) => r.payload[profile]);
  const empty = values.filter((v) => !v?.trim()).length;
  const freq = new Map<string, number>();
  for (const v of values) if (v) freq.set(v, (freq.get(v) ?? 0) + 1);
  const top = [...freq].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const max = Math.max(1, ...top.map(([, c]) => c));
  return (
    <>
      <div className="split even">
        <Sheet
          title="Source schema"
          id="source-schema"
          meta={
            <span className="mono">
              legacy_crm.customers · {state.sourceSchema.fields.length} fields
            </span>
          }
        >
          <ul className="field-list" aria-label="Source fields">
            {state.sourceSchema.fields.map((f, i) => (
              <li key={f.name}>
                <button
                  type="button"
                  className={profile === f.name ? "selected" : ""}
                  aria-pressed={profile === f.name}
                  onClick={() => setProfile(f.name)}
                >
                  <span className="field-no mono">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <code>{f.name}</code>
                  <span className="field-type">text · nullable</span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
        <Sheet
          title="Target schema"
          id="target-schema"
          meta={<span className="mono">target.customers · strict</span>}
        >
          <ul className="field-list target" aria-label="Target fields">
            {state.targetSchema.fields.map((f, i) => (
              <li key={f.name}>
                <div>
                  <span className="field-no mono">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <code>{f.name}</code>
                  <span className="field-type">{f.type}</span>
                  <span className="constraints">
                    {f.required && <span className="constraint">required</span>}
                    {f.unique && (
                      <span className="constraint strong">unique</span>
                    )}
                    {f.enum && (
                      <span className="constraint enum">
                        {f.enum.join(" · ")}
                      </span>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Sheet>
      </div>

      <Sheet
        title={
          <>
            Field profile · <code>{profile}</code>
          </>
        }
        id="profile-heading"
        meta={<span>Choose a source field to profile it</span>}
      >
        <div className="form-grid profile">
          <div className="box">
            <span className="box-label">
              <b>1</b>
              Empty values
            </span>
            <div className="box-value figure">
              {Math.round((empty / records.length) * 100)}%
            </div>
          </div>
          <div className="box">
            <span className="box-label">
              <b>2</b>
              Distinct values
            </span>
            <div className="box-value figure">{freq.size}</div>
          </div>
          <div className="box">
            <span className="box-label">
              <b>3</b>
              Longest value
            </span>
            <div className="box-value figure">
              {Math.max(0, ...values.map((v) => v?.length ?? 0))}
              <small> chars</small>
            </div>
          </div>
          <div className="box wide">
            <span className="box-label">
              <b>4</b>
              Most frequent
            </span>
            <ul className="frequency">
              {top.map(([value, count]) => (
                <li key={value}>
                  <code>{value}</code>
                  <span
                    className="bar"
                    style={{ "--w": count / max } as React.CSSProperties}
                    aria-hidden="true"
                  />
                  <span className="mono">×{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Sheet>

      <Sheet
        title="Source sample"
        id="sample-heading"
        meta={
          <span className="mono">
            {state.dataset.recordCount} / {state.maxRecords.toLocaleString()}{" "}
            record limit
          </span>
        }
      >
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th scope="col">Row</th>
                {state.sourceSchema.fields.map((f) => (
                  <th scope="col" key={f.name}>
                    <button
                      type="button"
                      className={`column-button ${profile === f.name ? "selected" : ""}`}
                      onClick={() => setProfile(f.name)}
                    >
                      {f.name}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.slice(page * 15, (page + 1) * 15).map((r) => (
                <tr key={r.rowIndex}>
                  <td className="row-no">{r.rowIndex + 1}</td>
                  {state.sourceSchema.fields.map((f) => (
                    <td
                      className={`mono ${f.name === profile ? "profiled" : ""}`}
                      key={f.name}
                    >
                      {fmt(r.payload[f.name])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={page}
          total={state.dataset.recordCount}
          onChange={setPage}
        />
      </Sheet>
    </>
  );
}
