import React, { useState, useEffect, useRef } from "react";
import toastHelper from "../../utils/toastHelper";
import { SubSkuFamily } from "./types";
import { StorageService } from "../../services/storage/storage.services";
import { RamService } from "../../services/ram/ram.services";
import { ColorService } from "../../services/color/color.services";
import placeholderImage from "../../../public/images/product/noimage.jpg";

interface ValidationErrors {
  subName?: string;
  subSkuSequence?: string;
}

interface TouchedFields {
  subName: boolean;
  subSkuSequence: boolean;
}

interface SubSkuFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: FormData) => Promise<void>;
  skuFamilyId: string;
  editItem?: SubSkuFamily & { _id?: string };
}

const SubSkuFamilyModal: React.FC<SubSkuFamilyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  skuFamilyId: _skuFamilyId,
  editItem,
}) => {
  const [formData, setFormData] = useState({
    subName: "",
    storageId: "",
    ramId: "",
    colorId: "",
    subSkuSequence: 1 as number | undefined,
  });
  const [storageText, setStorageText] = useState<string>("");
  const [ramText, setRamText] = useState<string>("");
  const [colorText, setColorText] = useState<string>("");
  const [storages, setStorages] = useState<
    { _id?: string; title: string; code?: string }[]
  >([]);
  const [rams, setRams] = useState<
    { _id?: string; title: string; code?: string }[]
  >([]);
  const [colors, setColors] = useState<
    { _id?: string; title: string; code?: string }[]
  >([]);
  const [storageLoading, setStorageLoading] = useState<boolean>(false);
  const [ramLoading, setRamLoading] = useState<boolean>(false);
  const [colorLoading, setColorLoading] = useState<boolean>(false);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newVideos, setNewVideos] = useState<File[]>([]);
  const [existingVideos, setExistingVideos] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string>("");
  const [videoError, setVideoError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );
  const [touched, setTouched] = useState<TouchedFields>({
    subName: false,
    subSkuSequence: false,
  });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const MAX_IMAGES = 10;
  const MAX_VIDEOS = 2;

  const base = (import.meta as { env?: { VITE_BASE_URL?: string } }).env?.VITE_BASE_URL || "";

  const getImageUrl = (path: string): string => {
    if (!path) return placeholderImage;
    const isAbsolute = /^https?:\/\//i.test(path);
    return isAbsolute
      ? path
      : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const getVideoUrl = (path: string): string => {
    if (!path) return "";
    const isAbsolute = /^https?:\/\//i.test(path);
    return isAbsolute
      ? path
      : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  // Helper function to capitalize
  const capitalize = (str: string): string => {
    if (!str) return str;
    return str.trim().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  // Helper function to generate code for master data
  // Pattern: PREFIX + 2 digits + 1 letter (e.g., STO00A, RAM00B, COL00A)
  const generateMasterCode = (prefix: string, existingItems: Array<{ code?: string }>): string => {
    // Filter items with codes matching the prefix pattern
    const prefixPattern = new RegExp(`^${prefix}\\d{2}[A-Z]$`);
    const matchingCodes = existingItems
      .filter(item => item.code && prefixPattern.test(item.code))
      .map(item => item.code!)
      .sort();

    if (matchingCodes.length === 0) {
      // Start with 00A
      return `${prefix}00A`;
    }

    // Get the last code
    const lastCode = matchingCodes[matchingCodes.length - 1];
    
    // Extract number and letter
    const match = lastCode.match(new RegExp(`^${prefix}(\\d{2})([A-Z])$`));
    if (!match) {
      // If pattern doesn't match, start fresh
      return `${prefix}00A`;
    }

    const number = parseInt(match[1], 10);
    const letter = match[2];

    // Increment: if letter is Z, move to next number and reset to A
    let nextNumber = number;
    let nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1);

    if (nextLetter > 'Z') {
      nextNumber += 1;
      nextLetter = 'A';
    }

    // Format number with leading zeros (2 digits)
    const formattedNumber = nextNumber.toString().padStart(2, '0');
    
    return `${prefix}${formattedNumber}${nextLetter}`;
  };

  // Helper function to find or create storage
  const findOrCreateStorage = async (title: string): Promise<string> => {
    if (!title || !title.trim()) return "";
    const capitalizedTitle = capitalize(title.trim());
    
    // Check if storage exists
    const existing = storages.find(s => s.title && s.title.toLowerCase() === capitalizedTitle.toLowerCase());
    if (existing && existing._id) {
      return existing._id;
    }
    
    // Generate code for new storage
    const storageCode = generateMasterCode('STO', storages);
    
    // Create new storage with generated code
    try {
      const response = await StorageService.createStorage({ 
        title: capitalizedTitle,
        code: storageCode
      });
      const newStorageId = response?.data?._id || response?.data?.data?._id;
      if (newStorageId) {
        // Refresh storages list
        const storageResponse = await StorageService.getStorageList(1, 1000);
        const storagesList = (storageResponse.data.docs || []).filter((storage: { _id?: string; title?: string }) => storage && storage._id && storage.title && typeof storage.title === 'string');
        setStorages(storagesList);
        return newStorageId;
      }
      throw new Error("Failed to get storage ID after creation");
    } catch (error) {
      console.error("Error creating storage:", error);
      throw error;
    }
  };

  // Helper function to find or create RAM
  const findOrCreateRam = async (title: string): Promise<string> => {
    if (!title || !title.trim()) return "";
    const capitalizedTitle = capitalize(title.trim());
    
    // Check if RAM exists
    const existing = rams.find(r => r.title && r.title.toLowerCase() === capitalizedTitle.toLowerCase());
    if (existing && existing._id) {
      return existing._id;
    }
    
    // Generate code for new RAM
    const ramCode = generateMasterCode('RAM', rams);
    
    // Create new RAM with generated code
    try {
      const response = await RamService.createRam({ 
        title: capitalizedTitle,
        code: ramCode
      });
      const newRamId = response?.data?._id || response?.data?.data?._id;
      if (newRamId) {
        // Refresh RAMs list
        const ramResponse = await RamService.getRamList(1, 1000);
        const ramsList = (ramResponse.data.docs || []).filter((ram: { _id?: string; title?: string }) => ram && ram._id && ram.title && typeof ram.title === 'string');
        setRams(ramsList);
        return newRamId;
      }
      throw new Error("Failed to get RAM ID after creation");
    } catch (error) {
      console.error("Error creating RAM:", error);
      throw error;
    }
  };

  // Helper function to find or create color
  const findOrCreateColor = async (title: string): Promise<string> => {
    if (!title || !title.trim()) return "";
    const capitalizedTitle = capitalize(title.trim());
    
    // Check if color exists
    const existing = colors.find(c => c.title && c.title.toLowerCase() === capitalizedTitle.toLowerCase());
    if (existing && existing._id) {
      return existing._id;
    }
    
    // Generate code for new color
    const colorCode = generateMasterCode('COL', colors);
    
    // Create new color with generated code
    try {
      const response = await ColorService.createColor({ 
        title: capitalizedTitle,
        code: colorCode
      });
      const newColorId = response?.data?._id || response?.data?.data?._id;
      if (newColorId) {
        // Refresh colors list
        const colorResponse = await ColorService.getColorList(1, 1000);
        const colorsList = (colorResponse.data.docs || []).filter((color: { _id?: string; title?: string }) => color && color._id && color.title && typeof color.title === 'string');
        setColors(colorsList);
        return newColorId;
      }
      throw new Error("Failed to get color ID after creation");
    } catch (error) {
      console.error("Error creating color:", error);
      throw error;
    }
  };

  useEffect(() => {
    const resetStates = () => {
      setNewImages([]);
      setNewVideos([]);
      setImageError("");
      setVideoError("");
      setApiError("");
      setValidationErrors({});
      setTouched({
        subName: false,
        subSkuSequence: false,
      });
    };

    if (!isOpen) {
      setFormData({
        subName: "",
        storageId: "",
        ramId: "",
        colorId: "",
        subSkuSequence: 1,
      });
      setStorageText("");
      setRamText("");
      setColorText("");
      setExistingImages([]);
      setExistingVideos([]);
      setNewImages([]);
      setNewVideos([]);
      resetStates();
      return;
    }

    resetStates();

    if (editItem) {
      const storageId = typeof editItem.storageId === "object"
        ? editItem.storageId?._id || ""
        : editItem.storageId || "";

      const ramId = typeof editItem.ramId === "object"
        ? editItem.ramId?._id || ""
        : editItem.ramId || "";

      const colorId = typeof editItem.colorId === "object"
        ? editItem.colorId?._id || ""
        : editItem.colorId || "";
      
      setFormData({
        subName: editItem.subName || "",
        storageId: storageId,
        ramId: ramId,
        colorId: colorId,
        subSkuSequence: editItem.subSkuSequence ?? 1,
      });
      // Set text values for display
      setStorageText(typeof editItem.storageId === 'object' ? editItem.storageId?.title || "" : "");
      setRamText(typeof editItem.ramId === 'object' ? editItem.ramId?.title || "" : "");
      setColorText(typeof editItem.colorId === 'object' ? editItem.colorId?.title || "" : "");

      if (editItem.images) {
        const imageArray = Array.isArray(editItem.images) 
          ? editItem.images.filter(img => img && String(img).trim() !== "")
          : [];
        setExistingImages(imageArray);
      }

      if (editItem.videos) {
        const videoArray = Array.isArray(editItem.videos) 
          ? editItem.videos.filter(vid => vid && String(vid).trim() !== "")
          : [];
        setExistingVideos(videoArray);
      }
    } else {
      setFormData({
        subName: "",
        storageId: "",
        ramId: "",
        colorId: "",
        subSkuSequence: 1,
      });
      setExistingImages([]);
      setExistingVideos([]);
    }
  }, [isOpen, editItem]);

  // Fetch all dropdown data on mount
  useEffect(() => {
    const fetchStorages = async () => {
      try {
        setStorageLoading(true);
        const response = await StorageService.getStorageList(1, 1000);
        const storagesList = (response.data.docs || []).filter((storage: { _id?: string; title?: string }) => storage && storage._id && storage.title && typeof storage.title === 'string');
        setStorages(storagesList);
      } catch (error) {
        console.error("Failed to load Storages:", error);
      } finally {
        setStorageLoading(false);
      }
    };

    const fetchRams = async () => {
      try {
        setRamLoading(true);
        const response = await RamService.getRamList(1, 1000);
        const ramsList = (response.data.docs || []).filter((ram: { _id?: string; title?: string }) => ram && ram._id && ram.title && typeof ram.title === 'string');
        setRams(ramsList);
      } catch (error) {
        console.error("Failed to load RAMs:", error);
      } finally {
        setRamLoading(false);
      }
    };

    const fetchColors = async () => {
      try {
        setColorLoading(true);
        const response = await ColorService.getColorList(1, 1000);
        const colorsList = (response.data.docs || []).filter((color: { _id?: string; title?: string }) => color && color._id && color.title && typeof color.title === 'string');
        setColors(colorsList);
      } catch (error) {
        console.error("Failed to load Colors:", error);
      } finally {
        setColorLoading(false);
      }
    };

    fetchStorages();
    fetchRams();
    fetchColors();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touched[name as keyof TouchedFields]) {
      const error = validateField(name as keyof typeof formData, value);
      setValidationErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, _type?: 'image' | 'video') => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: 'image' | 'video') => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((file) =>
      type === 'image' ? file.type.startsWith("image/") : file.type.startsWith("video/")
    );
    
    if (type === 'image') {
      const totalImages = existingImages.length + newImages.length + files.length;
      if (totalImages > MAX_IMAGES) {
        setImageError(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }
      if (files.length > 0) {
        setImageError("");
        setNewImages((prev) => [...prev, ...files]);
      }
    } else {
      const totalVideos = existingVideos.length + newVideos.length + files.length;
      if (totalVideos > MAX_VIDEOS) {
        setVideoError(`Maximum ${MAX_VIDEOS} videos allowed`);
        return;
      }
      if (files.length > 0) {
        setVideoError("");
        setNewVideos((prev) => [...prev, ...files]);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    
    if (type === 'image') {
      const totalImages = existingImages.length + newImages.length + files.length;
      if (totalImages > MAX_IMAGES) {
        setImageError(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }
      setImageError("");
      setNewImages((prev) => [...prev, ...files]);
    } else {
      const totalVideos = existingVideos.length + newVideos.length + files.length;
      if (totalVideos > MAX_VIDEOS) {
        setVideoError(`Maximum ${MAX_VIDEOS} videos allowed`);
        return;
      }
      setVideoError("");
      setNewVideos((prev) => [...prev, ...files]);
    }
  };

  const handleClick = (type: 'image' | 'video') => {
    if (type === 'image') {
      imageInputRef.current?.click();
    } else {
      videoInputRef.current?.click();
    }
  };

  const handleRemoveExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
    setImageError("");
  };

  const handleRemoveNewImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setImageError("");
  };

  const handleRemoveExistingVideo = (index: number) => {
    setExistingVideos((prev) => prev.filter((_, i) => i !== index));
    setVideoError("");
  };

  const handleRemoveNewVideo = (index: number) => {
    setNewVideos((prev) => prev.filter((_, i) => i !== index));
    setVideoError("");
  };

  const validateField = (
    _name: keyof typeof formData,
    _value: string | number | undefined
  ): string | undefined => {
    // subName is now optional - if not provided, SKU Family name will be used
    return undefined;
  };

  // validateForm function removed - validation is handled inline
  // const validateForm = (): boolean => {
  //   const errors: ValidationErrors = {};
  //   // subName is now optional - if not provided, SKU Family name will be used
  //   setValidationErrors(errors);
  //   return true;
  // };

  const handleBlur = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    const fieldName = name as keyof typeof formData;
    const fieldValue = formData[fieldName];
    const error = validateField(fieldName, typeof fieldValue === 'string' ? fieldValue : undefined);
    if (name === 'subName') {
      setValidationErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setTouched({
      subName: true,
      subSkuSequence: true,
    });

    // Validation is now optional for subName - if empty, backend will use SKU Family name
    // No need to block submission if subName is empty

    setIsLoading(true);
    setApiError("");

    try {
      // Find or create storage, RAM, and color
      let storageId = formData.storageId;
      let ramId = formData.ramId;
      let colorId = formData.colorId;

      if (storageText && storageText.trim()) {
        storageId = await findOrCreateStorage(storageText);
      }
      if (ramText && ramText.trim()) {
        ramId = await findOrCreateRam(ramText);
      }
      if (colorText && colorText.trim()) {
        colorId = await findOrCreateColor(colorText);
      }

      const formDataToSend = new FormData();
      
      // Create subSkuFamily object
      // Sub SKU Code will be auto-generated by backend
      // If subName is empty, send empty string so backend can use SKU Family name
      const subSkuFamilyData: any = {
        subName: formData.subName && formData.subName.trim() ? capitalize(formData.subName.trim()) : "",
        storageId: storageId || null,
        ramId: ramId || null,
        colorId: colorId || null,
        // subSkuCode will be auto-generated by backend, don't send it
        subSkuSequence: formData.subSkuSequence?.toString() || "1",
      };

      // Handle kept images
      if (editItem && existingImages.length > 0) {
        subSkuFamilyData.keptImages = JSON.stringify(existingImages);
      }

      // Handle kept videos
      if (editItem && existingVideos.length > 0) {
        subSkuFamilyData.keptVideos = JSON.stringify(existingVideos);
      }

      formDataToSend.append("subSkuFamily", JSON.stringify(subSkuFamilyData));

      // Append images
      newImages.forEach((image) => {
        formDataToSend.append("images", image);
      });

      // Append videos
      newVideos.forEach((video) => {
        formDataToSend.append("videos", video);
      });

      await onSave(formDataToSend);
      onClose();
    } catch (error) {
      const errorMessage =
        (error as Error).message || "Failed to save Sub SKU family";
      setApiError(errorMessage);
      toastHelper.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const title = editItem ? "Edit Sub SKU Family" : "Add Sub SKU Family";

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] transform transition-all duration-300 scale-100 flex flex-col">
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />

        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 p-6 pb-4 border-b border-gray-200 dark:border-gray-700 rounded-t-xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                {title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {editItem ? "Update Sub SKU Family information" : "Fill in the details to create a new Sub SKU Family"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-transform duration-200 hover:scale-110 p-2"
              disabled={isLoading}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form
            id="sub-sku-family-form"
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Basic Information Section */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <i className="fas fa-info-circle text-blue-600"></i>
                Basic Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                    Sub Name
                  </label>
                  <input
                    type="text"
                    name="subName"
                    value={formData.subName}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full p-2.5 bg-white dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                      touched.subName && validationErrors.subName
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    placeholder="Enter Sub Name (optional - will use SKU Family name if empty)"
                    disabled={isLoading}
                  />
                  {touched.subName && validationErrors.subName && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {validationErrors.subName}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    If left empty, SKU Family name will be used
                  </p>
                </div>
                {editItem && editItem.subSkuCode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                      Sub SKU Code
                    </label>
                    <input
                      type="text"
                      value={editItem.subSkuCode}
                      className="w-full p-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 text-sm cursor-not-allowed"
                      disabled
                      readOnly
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Sub SKU Code is auto-generated
                    </p>
                  </div>
                )}
                {!editItem && (
                  <div>
                    <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                      Sub SKU Code
                    </label>
                    <div className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <i className="fas fa-magic text-blue-500"></i>
                        Will be auto-generated after saving
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Specifications Section */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <i className="fas fa-microchip text-blue-600"></i>
                Specifications
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                    Storage
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="storages-list"
                      value={storageText}
                      onChange={(e) => {
                        setStorageText(e.target.value);
                        // Clear storage ID when text changes
                        setFormData(prev => ({ ...prev, storageId: "" }));
                      }}
                      onBlur={async () => {
                        if (storageText && storageText.trim()) {
                          try {
                            const storageId = await findOrCreateStorage(storageText);
                            setFormData(prev => ({ ...prev, storageId }));
                          } catch (error) {
                            console.error("Error creating storage:", error);
                          }
                        }
                      }}
                      className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                      placeholder="Type storage name (will create if new)"
                      disabled={isLoading || storageLoading}
                    />
                    <datalist id="storages-list">
                      {storages
                        .filter(storage => storage && storage.title)
                        .map((storage, index) => (
                          <option key={storage._id || index} value={storage.title} />
                        ))}
                    </datalist>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Type to search or create new storage
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                    RAM
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="rams-list"
                      value={ramText}
                      onChange={(e) => {
                        setRamText(e.target.value);
                        // Clear RAM ID when text changes
                        setFormData(prev => ({ ...prev, ramId: "" }));
                      }}
                      onBlur={async () => {
                        if (ramText && ramText.trim()) {
                          try {
                            const ramId = await findOrCreateRam(ramText);
                            setFormData(prev => ({ ...prev, ramId }));
                          } catch (error) {
                            console.error("Error creating RAM:", error);
                          }
                        }
                      }}
                      className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                      placeholder="Type RAM name (will create if new)"
                      disabled={isLoading || ramLoading}
                    />
                    <datalist id="rams-list">
                      {rams
                        .filter(ram => ram && ram.title)
                        .map((ram, index) => (
                          <option key={ram._id || index} value={ram.title} />
                        ))}
                    </datalist>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Type to search or create new RAM
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                    Color
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="colors-list"
                      value={colorText}
                      onChange={(e) => {
                        setColorText(e.target.value);
                        // Clear color ID when text changes
                        setFormData(prev => ({ ...prev, colorId: "" }));
                      }}
                      onBlur={async () => {
                        if (colorText && colorText.trim()) {
                          try {
                            const colorId = await findOrCreateColor(colorText);
                            setFormData(prev => ({ ...prev, colorId }));
                          } catch (error) {
                            console.error("Error creating color:", error);
                          }
                        }
                      }}
                      className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                      placeholder="Type color name (will create if new)"
                      disabled={isLoading || colorLoading}
                    />
                    <datalist id="colors-list">
                      {colors
                        .filter(color => color && color.title)
                        .map((color, index) => (
                          <option key={color._id || index} value={color.title} />
                        ))}
                    </datalist>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Type to search or create new color
                  </p>
                </div>
              </div>
            </div>

            {/* Images Section */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <i className="fas fa-images text-blue-600"></i>
                Images
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                  (Max {MAX_IMAGES} images)
                </span>
              </h3>
              <div
                onDragOver={(e) => handleDragOver(e, 'image')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'image')}
                onClick={() => handleClick('image')}
                className={`w-full p-6 bg-white dark:bg-gray-800 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
                }`}
              >
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={(e) => handleFileChange(e, 'image')}
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={isLoading}
                />
                {existingImages.length + newImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {existingImages.map((url, index) => (
                      <div
                        key={`existing-${index}`}
                        className="relative group"
                      >
                        <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                          <img
                            src={getImageUrl(url)}
                            alt={`Existing ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                placeholderImage;
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveExistingImage(index);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                          disabled={isLoading}
                        >
                          <i className="fas fa-times text-xs"></i>
                        </button>
                      </div>
                    ))}
                    {newImages.map((image, index) => (
                      <div key={`new-${index}`} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Uploaded ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveNewImage(index);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                          disabled={isLoading}
                        >
                          <i className="fas fa-times text-xs"></i>
                        </button>
                      </div>
                    ))}
                    {existingImages.length + newImages.length < MAX_IMAGES && (
                      <div
                        className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer bg-gray-50 dark:bg-gray-700/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClick('image');
                        }}
                      >
                        <i className="fas fa-plus text-2xl text-gray-400 dark:text-gray-500 mb-2"></i>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Add More</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <i className="fas fa-cloud-upload-alt text-5xl text-gray-400 dark:text-gray-500 mb-4"></i>
                    <p className="text-gray-600 dark:text-gray-400 text-base font-medium mb-2">
                      Drag & drop images here or click to browse
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                      Supports JPG, PNG, GIF (max {MAX_IMAGES} images)
                    </p>
                  </div>
                )}
              </div>
              {imageError && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-2">
                  <i className="fas fa-exclamation-circle"></i>
                  {imageError}
                </p>
              )}
            </div>

            {/* Videos Section */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <i className="fas fa-video text-blue-600"></i>
                Videos
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                  (Max {MAX_VIDEOS} videos)
                </span>
              </h3>
              <div
                onDragOver={(e) => handleDragOver(e, 'video')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'video')}
                onClick={() => handleClick('video')}
                className={`w-full p-6 bg-white dark:bg-gray-800 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
                }`}
              >
                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={(e) => handleFileChange(e, 'video')}
                  accept="video/*"
                  multiple
                  className="hidden"
                  disabled={isLoading}
                />
                {existingVideos.length + newVideos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {existingVideos.map((url, index) => {
                      const videoUrl = getVideoUrl(url);
                      return (
                        <div
                          key={`existing-video-${index}`}
                          className="relative group"
                        >
                          <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 relative">
                            <video
                              src={videoUrl}
                              className="w-full h-full object-cover"
                              preload="metadata"
                              muted
                              onError={(e) => {
                                // If video fails to load, show icon
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector('.video-fallback')) {
                                  const fallback = document.createElement('div');
                                  fallback.className = 'video-fallback absolute inset-0 flex items-center justify-center';
                                  fallback.innerHTML = '<i class="fas fa-video text-3xl text-gray-400"></i>';
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVideo(videoUrl);
                                }}
                                className="bg-white/90 hover:bg-white text-gray-800 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all hover:scale-110"
                                disabled={isLoading}
                              >
                                <i className="fas fa-play text-lg ml-1"></i>
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveExistingVideo(index);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100 z-10"
                            disabled={isLoading}
                          >
                            <i className="fas fa-times text-xs"></i>
                          </button>
                        </div>
                      );
                    })}
                    {newVideos.map((video, index) => {
                      const videoUrl = URL.createObjectURL(video);
                      return (
                        <div key={`new-video-${index}`} className="relative group">
                          <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 relative">
                            <video
                              src={videoUrl}
                              className="w-full h-full object-cover"
                              preload="metadata"
                              muted
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVideo(videoUrl);
                                }}
                                className="bg-white/90 hover:bg-white text-gray-800 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all hover:scale-110"
                                disabled={isLoading}
                              >
                                <i className="fas fa-play text-lg ml-1"></i>
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveNewVideo(index);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100 z-10"
                            disabled={isLoading}
                          >
                            <i className="fas fa-times text-xs"></i>
                          </button>
                        </div>
                      );
                    })}
                    {existingVideos.length + newVideos.length < MAX_VIDEOS && (
                      <div
                        className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer bg-gray-50 dark:bg-gray-700/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClick('video');
                        }}
                      >
                        <i className="fas fa-plus text-2xl text-gray-400 dark:text-gray-500 mb-2"></i>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Add More</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <i className="fas fa-cloud-upload-alt text-5xl text-gray-400 dark:text-gray-500 mb-4"></i>
                    <p className="text-gray-600 dark:text-gray-400 text-base font-medium mb-2">
                      Drag & drop videos here or click to browse
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                      Supports MP4, MOV, AVI (max {MAX_VIDEOS} videos)
                    </p>
                  </div>
                )}
              </div>
              {videoError && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-2">
                  <i className="fas fa-exclamation-circle"></i>
                  {videoError}
                </p>
              )}
            </div>

            {/* Sequence Section */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <i className="fas fa-sort-numeric-down text-blue-600"></i>
                Display Order
              </h3>
              <div className="max-w-xs">
                <input
                  type="number"
                  name="subSkuSequence"
                  value={formData.subSkuSequence || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, subSkuSequence: value === '' ? undefined : parseInt(value) || 1 });
                  }}
                  min="1"
                  className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                  placeholder="Enter sequence number"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <i className="fas fa-info-circle"></i>
                  Lower numbers appear first in lists. Leave empty for auto-assignment.
                </p>
              </div>
            </div>

            {apiError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                  <i className="fas fa-exclamation-circle"></i>
                  {apiError}
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Video Viewer Modal */}
        {selectedVideo && (
          <div
            className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
            onClick={() => setSelectedVideo(null)}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Video Player
                </h3>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                <video
                  src={selectedVideo}
                  controls
                  autoPlay
                  className="w-full h-auto max-h-[70vh] rounded-lg"
                  onError={(e) => {
                    console.error('Video playback error:', e);
                    toastHelper.showTost('Failed to load video', 'error');
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 p-6 pt-4 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 text-sm font-medium"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="sub-sku-family-form"
              className="min-w-[160px] px-6 py-2.5 bg-[#0071E0] text-white rounded-lg hover:bg-blue-600 transition duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Saving...</span>
                </>
              ) : editItem ? (
                <>
                  <i className="fas fa-save"></i>
                  <span>Update Sub SKU Family</span>
                </>
              ) : (
                <>
                  <i className="fas fa-plus"></i>
                  <span>Add Sub SKU Family</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubSkuFamilyModal;

