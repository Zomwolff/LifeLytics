import { useState } from "react";
import { motion } from "framer-motion";

function ProfileRow({
  label,
  field,
  value,
  type = "text",
  options,
  editingField,
  draftValue,
  setDraftValue,
  setEditingField,
  onSave,
}) {
  const isEditing = editingField === field;

  return (
    <div className="rounded-xl border border-[#b8c7da] bg-[rgba(255,255,255,0.74)] px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#445b7d]">{label}</p>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setEditingField(field)}
            className="rounded-full border border-[#9eb1cc] bg-white/70 px-3 py-1 text-xs font-semibold text-[#2a3f60]"
          >
            Edit
          </button>
        ) : null}
      </div>

      {!isEditing ? (
        <p className="text-[1rem] font-semibold text-[#1a2b43]">{value ?? "-"}</p>
      ) : (
        <div className="space-y-2">
          {options ? (
            <select
              value={draftValue}
              onChange={(event) => setDraftValue(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#b7c5d9] bg-white px-3 text-sm font-medium text-[#1a2b43] outline-none"
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              value={draftValue}
              onChange={(event) => setDraftValue(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#b7c5d9] bg-white px-3 text-sm font-medium text-[#1a2b43] outline-none"
            />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSave(field)}
              className="rounded-lg border border-[#1f3f35] bg-[linear-gradient(160deg,#1f5a4b,#143c32)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingField(null)}
              className="rounded-lg border border-[#a8b8cf] bg-white px-3 py-1.5 text-xs font-semibold text-[#2a3f60]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Profile({ user, onSaveField, goBack }) {
  const [editingField, setEditingField] = useState(null);
  const [draftValue, setDraftValue] = useState("");
  const [error, setError] = useState("");

  function startEdit(field, value) {
    setError("");
    setEditingField(field);
    setDraftValue(value ?? "");
  }

  function handleSave(field) {
    const result = onSaveField({ field, value: draftValue });
    if (!result.ok) {
      setError(result.error || "Could not save field.");
      return;
    }
    setError("");
    setEditingField(null);
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-4 py-6"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,#71bcff_0%,rgba(113,188,255,0.32)_56%,transparent_100%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#69dcb0_0%,rgba(105,220,176,0.28)_56%,transparent_100%)] blur-2xl" />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[430px] flex-col"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            className="rounded-full border border-[#95a8c4] bg-[rgba(255,255,255,0.7)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#29405e]"
          >
            Back
          </button>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#3b4f6d]">Profile</p>
        </header>

        <div className="mb-3">
          <p className="mt-1 text-[1.5rem] font-semibold leading-[1.08] text-[#131722]" style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>
            {user?.name ? `${user.name}'s Details` : "Your Details"}
          </p>
        </div>

        <div className="space-y-3">
          <ProfileRow
            label="Name"
            field="name"
            value={user?.name}
            editingField={editingField}
            draftValue={draftValue}
            setDraftValue={setDraftValue}
            setEditingField={(field) => (field ? startEdit(field, user?.name) : setEditingField(null))}
            onSave={handleSave}
          />

          <ProfileRow
            label="Age"
            field="age"
            type="number"
            value={Number.isFinite(user?.age) ? String(user.age) : "-"}
            editingField={editingField}
            draftValue={draftValue}
            setDraftValue={setDraftValue}
            setEditingField={(field) => (field ? startEdit(field, user?.age ? String(user.age) : "") : setEditingField(null))}
            onSave={handleSave}
          />

          <ProfileRow
            label="Gender"
            field="gender"
            value={user?.gender || "-"}
            options={["Male", "Female", "Other", "Prefer not to say"]}
            editingField={editingField}
            draftValue={draftValue || "Male"}
            setDraftValue={setDraftValue}
            setEditingField={(field) => (field ? startEdit(field, user?.gender || "Male") : setEditingField(null))}
            onSave={handleSave}
          />

          <ProfileRow
            label="Height (cm)"
            field="heightCm"
            type="number"
            value={Number.isFinite(user?.heightCm) ? `${user.heightCm}` : "-"}
            editingField={editingField}
            draftValue={draftValue}
            setDraftValue={setDraftValue}
            setEditingField={(field) => (field ? startEdit(field, user?.heightCm ? String(user.heightCm) : "") : setEditingField(null))}
            onSave={handleSave}
          />

          <ProfileRow
            label="Weight (kg)"
            field="weightKg"
            type="number"
            value={Number.isFinite(user?.weightKg) ? `${user.weightKg}` : "-"}
            editingField={editingField}
            draftValue={draftValue}
            setDraftValue={setDraftValue}
            setEditingField={(field) => (field ? startEdit(field, user?.weightKg ? String(user.weightKg) : "") : setEditingField(null))}
            onSave={handleSave}
          />

          {error ? <p className="text-center text-xs font-semibold text-rose-600">{error}</p> : null}
        </div>
      </motion.div>
    </div>
  );
}
