"use client";

import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Tag,
  Sliders,
  AlertCircle,
  Sparkles,
  X,
  Layers,
  Edit2,
  Check,
} from "lucide-react";
import { estimateCombinationCount } from "@/utils/attribute.util";

const STANDARD_PRESETS = [
  { name: "Size", defaultValues: ["S", "M", "L", "XL"] },
  { name: "Color", defaultValues: ["Black", "White", "Blue"] },
  { name: "Material", defaultValues: ["Cotton", "Leather", "Polyester"] },
  { name: "Storage", defaultValues: ["64GB", "128GB", "256GB"] },
];

export default function AttributeBuilder({
  attributes = [],
  onChange,
  onGenerateClick,
  isGenerating = false,
}) {
  const [newAttrName, setNewAttrName] = useState("");
  const [valInputs, setValInputs] = useState({});
  const [editingValueTarget, setEditingValueTarget] = useState(null); // { attrIdx, valIdx, text }

  const { count, exceedsLimit, maxLimit } = estimateCombinationCount(attributes, 100);

  const handleAddAttribute = (nameToAdd, defaultVals = []) => {
    const cleanName = (nameToAdd || "").trim();
    if (!cleanName) return;

    if (attributes.some((a) => a.name.toLowerCase() === cleanName.toLowerCase())) {
      return;
    }

    const updated = [...attributes, { name: cleanName, values: defaultVals }];
    onChange(updated);
    setNewAttrName("");
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleAddAttribute(newAttrName, []);
  };

  const handleRemoveAttribute = (index) => {
    const updated = attributes.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleAddValue = (attrIndex) => {
    const inputVal = (valInputs[attrIndex] || "").trim();
    if (!inputVal) return;

    // Support comma-separated value pasting
    const valuesToAdd = inputVal
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const currentAttr = attributes[attrIndex];
    const existingVals = currentAttr.values || [];

    const newUniqueVals = valuesToAdd.filter(
      (nv) => !existingVals.some((ev) => ev.toLowerCase() === nv.toLowerCase())
    );

    if (newUniqueVals.length > 0) {
      const updated = attributes.map((a, i) =>
        i === attrIndex ? { ...a, values: [...(a.values || []), ...newUniqueVals] } : a
      );
      onChange(updated);
    }

    setValInputs((prev) => ({ ...prev, [attrIndex]: "" }));
  };

  const handleRemoveValue = (attrIndex, valIndex) => {
    const updated = attributes.map((a, i) =>
      i === attrIndex
        ? { ...a, values: a.values.filter((_, vi) => vi !== valIndex) }
        : a
    );
    onChange(updated);
    if (editingValueTarget && editingValueTarget.attrIdx === attrIndex && editingValueTarget.valIdx === valIndex) {
      setEditingValueTarget(null);
    }
  };

  const handleStartEditValue = (attrIdx, valIdx, currentText) => {
    setEditingValueTarget({ attrIdx, valIdx, text: currentText });
  };

  const handleSaveEditValue = () => {
    if (!editingValueTarget) return;
    const { attrIdx, valIdx, text } = editingValueTarget;
    const cleanText = (text || "").trim();
    if (!cleanText) return;

    const updated = attributes.map((a, i) => {
      if (i !== attrIdx) return a;
      const newVals = [...a.values];
      newVals[valIdx] = cleanText;
      return { ...a, values: newVals };
    });

    onChange(updated);
    setEditingValueTarget(null);
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="size-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Product Attributes &amp; Variation Axes
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure attribute axes like Size, Color, Material, or Storage to generate purchasable variant combinations.
          </p>
        </div>

        {/* Custom Attribute Name Input */}
        <form onSubmit={handleFormSubmit} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Custom attribute name..."
            value={newAttrName}
            onChange={(e) => setNewAttrName(e.target.value)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <button
            type="submit"
            disabled={!newAttrName.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs disabled:opacity-40 transition-colors shrink-0"
          >
            <Plus className="size-3.5" />
            <span>Add Attribute</span>
          </button>
        </form>
      </div>

      {/* Quick-Add Preset Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
          Quick Add Attributes:
        </span>
        {STANDARD_PRESETS.map((preset) => {
          const isAdded = attributes.some(
            (a) => a.name.toLowerCase() === preset.name.toLowerCase()
          );
          return (
            <button
              key={preset.name}
              type="button"
              disabled={isAdded}
              onClick={() => handleAddAttribute(preset.name, preset.defaultValues)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                isAdded
                  ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-200 hover:border-emerald-300 shadow-2xs"
              }`}
            >
              <Plus className="size-3 text-emerald-600" />
              <span>{preset.name}</span>
              {isAdded && <span className="text-[10px] text-slate-400">(Added)</span>}
            </button>
          );
        })}
      </div>

      {/* Attribute Cards List */}
      {attributes.length === 0 ? (
        <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
          <Tag className="size-8 text-slate-300 mx-auto" />
          <h4 className="text-xs font-bold text-slate-700">No Product Attributes Configured</h4>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Click any quick preset above (e.g. Size, Color, Material, Storage) or type a custom attribute name to create variation axes.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {attributes.map((attr, attrIdx) => (
            <div
              key={attr.name}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                    {attr.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({attr.values?.length || 0} values configured)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAttribute(attrIdx)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title={`Remove ${attr.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              {/* Tag / Chip values list */}
              <div className="flex flex-wrap items-center gap-2">
                {attr.values?.map((val, valIdx) => {
                  const isEditingThis =
                    editingValueTarget &&
                    editingValueTarget.attrIdx === attrIdx &&
                    editingValueTarget.valIdx === valIdx;

                  if (isEditingThis) {
                    return (
                      <div
                        key={`${val}-${valIdx}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border-2 border-emerald-500 shadow-xs"
                      >
                        <input
                          type="text"
                          value={editingValueTarget.text}
                          onChange={(e) =>
                            setEditingValueTarget((prev) => ({ ...prev, text: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveEditValue();
                            } else if (e.key === "Escape") {
                              setEditingValueTarget(null);
                            }
                          }}
                          autoFocus
                          className="w-20 text-xs font-semibold text-slate-800 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSaveEditValue}
                          className="p-0.5 text-emerald-700 hover:text-emerald-900"
                        >
                          <Check className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingValueTarget(null)}
                          className="p-0.5 text-slate-400 hover:text-slate-600"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <span
                      key={`${val}-${valIdx}`}
                      className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 shadow-2xs font-medium"
                    >
                      <span>{val}</span>
                      <button
                        type="button"
                        onClick={() => handleStartEditValue(attrIdx, valIdx, val)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-700 transition-opacity"
                        title="Edit value"
                      >
                        <Edit2 className="size-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveValue(attrIdx, valIdx)}
                        className="text-slate-400 hover:text-rose-600"
                        title="Remove value"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  );
                })}

                {/* Add value mini-input */}
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Add value (or comma separated)..."
                    value={valInputs[attrIdx] || ""}
                    onChange={(e) =>
                      setValInputs((prev) => ({ ...prev, [attrIdx]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddValue(attrIdx);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs w-48 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddValue(attrIdx)}
                    disabled={!(valInputs[attrIdx] || "").trim()}
                    className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold disabled:opacity-40"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Combination Estimator and Generation Action */}
      {attributes.length > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                Combination Estimate:
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
                {count} potential {count === 1 ? "variant" : "variants"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {attributes
                .filter((a) => a.values?.length > 0)
                .map((a) => `${a.values.length} ${a.name.toLowerCase()}`)
                .join(" × ")}
              {count > 0 ? ` = ${count} combinations` : ""}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {exceedsLimit && (
              <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>Limit exceeded (max {maxLimit}). Narrow attribute values.</span>
              </div>
            )}

            <button
              type="button"
              onClick={onGenerateClick}
              disabled={count === 0 || exceedsLimit || isGenerating}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs disabled:opacity-40 transition-colors"
            >
              <Sparkles className="size-3.5" />
              <span>{isGenerating ? "Generating..." : "Generate & Review Combinations"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
