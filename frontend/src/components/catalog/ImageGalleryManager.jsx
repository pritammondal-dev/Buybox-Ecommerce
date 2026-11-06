"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  UploadCloud,
  Plus,
  Trash2,
  Star,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Loader2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/product.service";

/**
 * ImageGalleryManager
 *
 * Professional WooCommerce-inspired product image & gallery manager.
 * Manages the primary product image and an ordered gallery of additional images.
 * Supports direct file uploads (via backend multipart API) and external image URLs.
 *
 * @param {Object} props
 * @param {Array} props.images - Array of { url, altText, publicId, sortOrder }
 * @param {Function} props.onChange - Callback with updated images array
 * @param {boolean} [props.disabled=false]
 */
export default function ImageGalleryManager({
  images = [],
  onChange,
  disabled = false,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [urlInputOpen, setUrlInputOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [altValue, setAltValue] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // "all" | "preview"
  const [editingAltIndex, setEditingAltIndex] = useState(null);
  const [tempAlt, setTempAlt] = useState("");
  const fileInputRef = useRef(null);

  const mainImage = images.length > 0 ? images[0] : null;
  const galleryImages = images.length > 1 ? images.slice(1) : [];

  // Handle file upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file triggers change
    e.target.value = "";

    // Client-side validation
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      toast.error("Invalid image format", {
        description: "Only JPEG, PNG, WEBP, GIF, and SVG files are supported.",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", {
        description: "Maximum image file size is 5MB.",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await productService.uploadProductImage(formData);
      const data = res?.data?.data || res?.data || {};
      const newUrl = data.url;
      const newAlt = data.altText || file.name.replace(/\.[^/.]+$/, "");

      if (!newUrl) {
        throw new Error("Server did not return a valid image URL");
      }

      const updated = [
        ...images,
        {
          url: newUrl,
          altText: newAlt,
          publicId: data.filename || null,
          sortOrder: images.length,
        },
      ];

      onChange(updated);
      toast.success("Image uploaded successfully");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Image upload failed", {
        description:
          err.response?.data?.message || err.message || "Could not upload image.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle URL Add
  const handleAddUrl = (e) => {
    e.preventDefault();
    const cleanUrl = urlValue.trim();
    if (!cleanUrl) return;

    try {
      new URL(cleanUrl);
    } catch {
      toast.error("Invalid URL", {
        description: "Please enter a valid HTTP or HTTPS image URL.",
      });
      return;
    }

    const updated = [
      ...images,
      {
        url: cleanUrl,
        altText: altValue.trim() || "Product Image",
        publicId: null,
        sortOrder: images.length,
      },
    ];

    onChange(updated);
    setUrlValue("");
    setAltValue("");
    setUrlInputOpen(false);
    toast.success("Image URL added to gallery");
  };

  // Make an image the primary main image (move to index 0)
  const handleSetMain = (index) => {
    if (index === 0) return;
    const target = images[index];
    const rest = images.filter((_, i) => i !== index);
    const updated = [target, ...rest].map((img, i) => ({
      ...img,
      sortOrder: i,
    }));
    onChange(updated);
    toast.success("Primary product image updated");
  };

  // Move image position
  const handleMove = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const copy = [...images];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    const updated = copy.map((img, i) => ({
      ...img,
      sortOrder: i,
    }));
    onChange(updated);
  };

  // Remove image
  const handleRemove = (index) => {
    const updated = images
      .filter((_, i) => i !== index)
      .map((img, i) => ({
        ...img,
        sortOrder: i,
      }));
    onChange(updated);
    toast.success("Image removed from gallery");
  };

  // Save edited alt text
  const handleSaveAlt = (index) => {
    const updated = images.map((img, i) =>
      i === index ? { ...img, altText: tempAlt.trim() } : img
    );
    onChange(updated);
    setEditingAltIndex(null);
    setTempAlt("");
    toast.success("Alt text saved");
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Media & Gallery Assets
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            The first image is used as the canonical thumbnail across store search, category cards, and shopping carts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#007A55] hover:bg-[#006346] active:scale-95 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UploadCloud className="size-3.5" />
            )}
            <span>{isUploading ? "Uploading..." : "Upload Image"}</span>
          </button>

          <button
            type="button"
            onClick={() => setUrlInputOpen(!urlInputOpen)}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <LinkIcon className="size-3.5" />
            <span>Add via URL</span>
          </button>
        </div>
      </div>

      {/* URL Add Modal/Dropdown */}
      {urlInputOpen && (
        <form
          onSubmit={handleAddUrl}
          className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <LinkIcon className="size-3.5 text-emerald-600" />
              Add Image from External URL
            </span>
            <button
              type="button"
              onClick={() => setUrlInputOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Direct Image URL *
              </label>
              <input
                type="url"
                required
                placeholder="https://example.com/photos/item-1.jpg"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Alt Description (SEO)
              </label>
              <input
                type="text"
                placeholder="e.g. Front View"
                value={altValue}
                onChange={(e) => setAltValue(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-[#007A55] text-white text-xs font-bold hover:bg-[#006346] shadow-xs transition-colors"
            >
              <Check className="size-3.5" />
              <span>Attach Image</span>
            </button>
          </div>
        </form>
      )}

      {/* Main & Gallery Layout */}
      {images.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:border-emerald-500/50 hover:bg-emerald-50/20 transition-all cursor-pointer group"
        >
          <div className="size-14 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto mb-3 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
            <ImageIcon className="size-7" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">
            No Images Attached Yet
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Click here to upload product photography, or paste image URLs. High-resolution clean background images maximize conversion.
          </p>
          <span className="inline-block mt-3 px-3.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            Supports JPG, PNG, WEBP, GIF, SVG up to 5MB
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Primary Image Hero Card */}
          <div className="md:col-span-1 space-y-2">
            <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
              <Star className="size-3 text-amber-500 fill-amber-400" />
              Primary Featured Image
            </span>

            {mainImage ? (
              <div className="group relative rounded-2xl border-2 border-emerald-600/60 bg-slate-50 overflow-hidden shadow-xs aspect-square flex items-center justify-center">
                <Image
                  src={mainImage.url}
                  alt={mainImage.altText || "Main Product Image"}
                  fill
                  className="object-contain p-2"
                  unoptimized
                />

                <div className="absolute top-2 left-2 z-10">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#007A55] text-white shadow-2xs">
                    Main Photo
                  </span>
                </div>

                {/* Hover overlay with action tools */}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAltIndex(0);
                      setTempAlt(mainImage.altText || "");
                    }}
                    className="p-2 rounded-xl bg-white text-slate-800 hover:bg-slate-100 text-xs font-semibold shadow-xs"
                    title="Edit Alt Text"
                  >
                    Alt
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(0)}
                    disabled={disabled}
                    className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                    title="Remove Main Image"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="absolute bottom-2 inset-x-2 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-xl text-[10px] text-slate-600 truncate border border-slate-200">
                  {mainImage.altText || "No Alt text defined"}
                </div>
              </div>
            ) : null}
          </div>

          {/* Additional Gallery Thumbnails Grid */}
          <div className="md:col-span-2 space-y-2">
            <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">
              Additional Gallery Angles ({galleryImages.length})
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {galleryImages.map((img, idx) => {
                const actualIndex = idx + 1;
                return (
                  <div
                    key={img.url + actualIndex}
                    className="group relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-2xs aspect-square flex items-center justify-center"
                  >
                    <Image
                      src={img.url}
                      alt={img.altText || `Gallery image ${actualIndex}`}
                      fill
                      className="object-contain p-2"
                      unoptimized
                    />

                    {/* Badge */}
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-white/90 text-slate-700 border border-slate-200">
                        #{actualIndex + 1}
                      </span>
                    </div>

                    {/* Hover controls overlay */}
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMove(actualIndex, -1)}
                          disabled={actualIndex <= 1}
                          className="p-1 rounded-lg bg-white/90 text-slate-800 hover:bg-white disabled:opacity-40"
                          title="Move Left"
                        >
                          <ChevronLeft className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(actualIndex, 1)}
                          disabled={actualIndex >= images.length - 1}
                          className="p-1 rounded-lg bg-white/90 text-slate-800 hover:bg-white disabled:opacity-40"
                          title="Move Right"
                        >
                          <ChevronRight className="size-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSetMain(actualIndex)}
                          className="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold shadow-2xs"
                          title="Make Main Featured Image"
                        >
                          Make Main
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(actualIndex)}
                          className="p-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-2xs"
                          title="Delete image"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Caption */}
                    <div className="absolute bottom-1 inset-x-1 bg-white/90 px-1.5 py-0.5 rounded-md text-[9px] text-slate-600 truncate border border-slate-200">
                      {img.altText || `Angle ${actualIndex + 1}`}
                    </div>
                  </div>
                );
              })}

              {/* Quick Add Card */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 aspect-square flex flex-col items-center justify-center p-3 text-slate-400 hover:text-emerald-700 transition-all cursor-pointer disabled:opacity-50"
              >
                <Plus className="size-5 mb-1" />
                <span className="text-[10px] font-bold">Add Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Alt Text Editor Modal */}
      {editingAltIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 max-w-sm w-full space-y-3 shadow-xl">
            <h4 className="text-xs font-bold text-slate-900">
              Edit Accessibility Alt Text
            </h4>
            <p className="text-[11px] text-slate-500">
              Clear descriptive text helps search engines index your product and enables screen readers.
            </p>
            <input
              type="text"
              value={tempAlt}
              onChange={(e) => setTempAlt(e.target.value)}
              placeholder="e.g. Matte black top-down angle view"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingAltIndex(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveAlt(editingAltIndex)}
                className="px-4 py-1.5 rounded-xl bg-[#007A55] text-white text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
