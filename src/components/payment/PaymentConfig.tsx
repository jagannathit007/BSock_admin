import React, { useState, useEffect } from "react";
import toastHelper from "../../utils/toastHelper";
import { PaymentConfigService } from "../../services/payment/paymentConfig.services";
import { useModulePermissions } from "../../hooks/useModulePermissions";

// Interface for Payment Config data
interface SpecificField {
  name: string;
  type: "text" | "number" | "select" | "textarea" | "file" | "image";
  mandatory: boolean;
  providedByAdmin?: boolean;
  value?: string;
  options?: string[];
}

interface PaymentModule {
  name: string;
  enabled: boolean;
  termsAndConditions: boolean;
  specificFields: SpecificField[];
}

interface SharedField {
  name: string;
  type: "text" | "number" | "select" | "textarea" | "file";
  mandatory: boolean;
  options?: string[];
}

interface PaymentConfig {
  _id?: string;
  modules: PaymentModule[];
  sharedFields: SharedField[];
  createdAt?: string;
  updatedAt?: string;
}

interface PaymentConfigProps {
  onRenderButtons?: (buttons: React.ReactNode) => void;
}

const PaymentConfig: React.FC<PaymentConfigProps> = ({ onRenderButtons: _onRenderButtons }) => {
  const { canWrite } = useModulePermissions('/configuration');
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingModuleIndex, setEditingModuleIndex] = useState<number | null>(
    null
  );
  const [isSharedFieldsModalOpen, setIsSharedFieldsModalOpen] =
    useState<boolean>(false);
  const [sharedFieldsAccordionOpen, setSharedFieldsAccordionOpen] =
    useState<boolean>(false);
  const [ttAccordionOpen, setTTAccordionOpen] = useState<boolean>(false);
  const [thirdPartyAccordionOpen, setThirdPartyAccordionOpen] =
    useState<boolean>(false);
  const [cashAccordionOpen, setCashAccordionOpen] = useState<boolean>(false);

  // Form state
  const [formData, setFormData] = useState<PaymentConfig>({
    modules: [],
    sharedFields: [],
  });

  // Field types
  const fieldTypes = ["text", "number", "select", "textarea", "file", "image"];
  const sharedFieldTypes = ["text", "number", "select", "textarea", "file"];

  // Payment types
  const paymentTypes = ["TT", "ThirdParty", "Cash"];

  // Check if all payment types are already added
  const allPaymentTypesAdded = () => {
    const existingTypes = formData.modules.map((module) => module.name);
    return paymentTypes.every((type) => existingTypes.includes(type));
  };

  // Fetch payment config
  useEffect(() => {
    fetchPaymentConfig();
  }, []);

  // Render buttons in parent component header
  // useEffect(() => {
  //   if (onRenderButtons) {
  //     if (paymentConfig) {
  //       onRenderButtons(
  //         <div className="flex items-center gap-1">
  //           <button
  //             onClick={openEditModal}
  //             className="inline-flex items-center gap-1 rounded-lg bg-[#0071E0] text-white px-4 py-2 text-sm font-medium hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
  //           >
  //             <i className="fas fa-edit text-xs"></i>
  //             Edit
  //           </button>
  //           <button
  //             onClick={handleDeleteConfig}
  //             className="inline-flex items-center gap-1 rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-700 transition-colors"
  //           >
  //             <i className="fas fa-trash text-xs"></i>
  //             Delete
  //           </button>
  //         </div>
  //       );
  //     } else {
  //       onRenderButtons(null);
  //     }
  //   }
  // }, [paymentConfig, onRenderButtons]);


  const fetchPaymentConfig = async () => {
    try {
      setLoading(true);
      const response = await PaymentConfigService.listPaymentConfigs(1, 1);
      const docs = response?.data?.docs || [];

      if (docs.length > 0) {
        setPaymentConfig(docs[0]);
      } else {
        setPaymentConfig(null);
      }
    } catch (error) {
      console.error("Failed to fetch payment config:", error);
      toastHelper.showTost(
        (error as any)?.message || "Failed to fetch payment config",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddEditConfig = async () => {
    try {
      if (isEditMode && paymentConfig?._id) {
        await PaymentConfigService.updatePaymentConfig({
          id: paymentConfig._id,
          modules: formData.modules,
          sharedFields: formData.sharedFields,
        });
        toastHelper.showTost("Payment config updated successfully!", "success");
      } else {
        await PaymentConfigService.addPaymentConfig(formData);
        toastHelper.showTost("Payment config added successfully!", "success");
      }
      setIsModalOpen(false);
      setIsSharedFieldsModalOpen(false);
      resetForm();
      fetchPaymentConfig();
    } catch (error) {
      console.error("Failed to save payment config:", error);
      toastHelper.showTost("Failed to save payment config!", "error");
    }
  };

  const openModuleEditModal = (moduleIndex: number) => {
    if (!paymentConfig) return;
    setIsEditMode(true);
    setFormData(paymentConfig);
    setEditingModuleIndex(moduleIndex);
    setIsModalOpen(true);
  };

  const openSharedFieldsModal = () => {
    if (!paymentConfig) return;
    setIsEditMode(true);
    setFormData(paymentConfig);
    setEditingModuleIndex(null);
    setIsSharedFieldsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      modules: [],
      sharedFields: [],
    });
    setEditingModuleIndex(null);
    setIsSharedFieldsModalOpen(false);
  };

  // Handler for updating module status
  const handleToggleModuleStatus = async (
    moduleIndex: number,
    enabled: boolean
  ) => {
    if (!paymentConfig?._id) return;

    try {
      const response = await PaymentConfigService.updateModuleStatus(
        paymentConfig._id,
        moduleIndex,
        enabled
      );
      if (response.data) {
        setPaymentConfig(response.data);
      }
    } catch (error) {
      console.error("Failed to update module status:", error);
      // Revert the UI state on error
      fetchPaymentConfig();
    }
  };

  // Handler for updating module terms & conditions
  const handleToggleModuleTerms = async (
    moduleIndex: number,
    termsAndConditions: boolean
  ) => {
    if (!paymentConfig?._id) return;

    try {
      const response = await PaymentConfigService.updateModuleTermsAndConditions(
        paymentConfig._id,
        moduleIndex,
        termsAndConditions
      );
      if (response.data) {
        setPaymentConfig(response.data);
      }
    } catch (error) {
      console.error("Failed to update terms & conditions:", error);
      // Revert the UI state on error
      fetchPaymentConfig();
    }
  };

  // Handler for updating shared field required status
  const handleToggleSharedFieldRequired = async (
    fieldIndex: number,
    mandatory: boolean
  ) => {
    if (!paymentConfig?._id) return;

    try {
      const updatedSharedFields = [...paymentConfig.sharedFields];
      updatedSharedFields[fieldIndex] = {
        ...updatedSharedFields[fieldIndex],
        mandatory: mandatory,
      };

      const response = await PaymentConfigService.updatePaymentConfig({
        id: paymentConfig._id,
        sharedFields: updatedSharedFields,
      });
      if (response.data) {
        setPaymentConfig(response.data);
      }
    } catch (error) {
      console.error("Failed to update shared field required status:", error);
      // Revert the UI state on error
      fetchPaymentConfig();
    }
  };

  // Helper functions for managing form data
  const addModule = () => {
    setFormData({
      ...formData,
      modules: [
        ...formData.modules,
        {
          name: "",
          enabled: true,
          termsAndConditions: true,
          specificFields: [],
        },
      ],
    });
  };

  const updateModule = (index: number, module: PaymentModule) => {
    const updatedModules = [...formData.modules];
    updatedModules[index] = module;
    setFormData({
      ...formData,
      modules: updatedModules,
    });
  };

  const addSpecificField = (moduleIndex: number) => {
    const updatedModules = [...formData.modules];
    updatedModules[moduleIndex].specificFields.push({
      name: "",
      type: "text",
      mandatory: false,
    });
    setFormData({
      ...formData,
      modules: updatedModules,
    });
  };

  const updateSpecificField = (
    moduleIndex: number,
    fieldIndex: number,
    field: SpecificField
  ) => {
    const updatedModules = [...formData.modules];
    updatedModules[moduleIndex].specificFields[fieldIndex] = field;
    setFormData({
      ...formData,
      modules: updatedModules,
    });
  };

  const removeSpecificField = (moduleIndex: number, fieldIndex: number) => {
    const updatedModules = [...formData.modules];
    updatedModules[moduleIndex].specificFields.splice(fieldIndex, 1);
    setFormData({
      ...formData,
      modules: updatedModules,
    });
  };

  const addSharedField = () => {
    setFormData({
      ...formData,
      sharedFields: [
        ...formData.sharedFields,
        {
          name: "",
          type: "text",
          mandatory: false,
        },
      ],
    });
  };

  const updateSharedField = (index: number, field: SharedField) => {
    const updatedSharedFields = [...formData.sharedFields];
    updatedSharedFields[index] = field;
    setFormData({
      ...formData,
      sharedFields: updatedSharedFields,
    });
  };

  const removeSharedField = (index: number) => {
    const updatedSharedFields = formData.sharedFields.filter(
      (_, i) => i !== index
    );
    setFormData({
      ...formData,
      sharedFields: updatedSharedFields,
    });
  };

  // Get field type icon
  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case "text":
        return "fas fa-font";
      case "number":
        return "fas fa-hashtag";
      case "select":
        return "fas fa-list";
      case "textarea":
        return "fas fa-align-left";
      case "file":
        return "fas fa-file";
      case "image":
        return "fas fa-image";
      default:
        return "fas fa-question";
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Loading Payment Configuration...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 max-w-7xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-900">
      {paymentConfig ? (
        <div className="space-y-8">
          {/* Payment Modules Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <i className="fas fa-credit-card text-blue-600 dark:text-blue-400"></i>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Payment Modules
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span>Field Required</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>Default Value Added</span>
                </div>
              </div>
            </div>

            {paymentConfig.modules.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <i className="fas fa-credit-card text-gray-400 text-2xl"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Payment Modules
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Click edit to add payment modules
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm ">
                <div className="">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Payment Method
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Terms & Conditions
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Specific Fields
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paymentConfig.modules.map((module, index) => (
                        <tr
                    key={index}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                          <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              module.enabled
                                ? "bg-green-100 dark:bg-green-900"
                                : "bg-red-100 dark:bg-red-900"
                            }`}
                          >
                            <i
                              className={`fas fa-${
                                module.name === "TT"
                                  ? "university"
                                  : module.name === "ThirdParty"
                                  ? "handshake"
                                  : module.name === "Cash"
                                  ? "money-bill"
                                  : "credit-card"
                              } ${
                                module.enabled
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            ></i>
                          </div>
                          <div>
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {module.name || "Unnamed Module"}
                          </div>
                        </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              onClick={() =>
                                handleToggleModuleStatus(index, !module.enabled)
                              }
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 hover:opacity-80 ${
                                module.enabled
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                              }`}
                              title={`Click to ${module.enabled ? "disable" : "enable"}`}
                            >
                              {module.enabled ? "Enabled" : "Disabled"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              onClick={() =>
                                handleToggleModuleTerms(index, !module.termsAndConditions)
                              }
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 hover:opacity-80 ${
                                module.termsAndConditions
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                              title={`Click to ${module.termsAndConditions ? "make not required" : "make required"}`}
                            >
                              <i className="fas fa-file-contract w-4 h-4 mr-2"></i>
                              {module.termsAndConditions ? "Required" : "Not Required"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              {module.specificFields.length > 0 ? (
                                <>
                              {module.specificFields
                                .slice(0, 3)
                                .map((field, fieldIndex) => (
                                  <div
                                    key={fieldIndex}
                                        className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 rounded-md px-2 py-1"
                                  >
                                      <i
                                        className={`${getFieldTypeIcon(
                                          field.type
                                        )} text-gray-400 text-xs`}
                                      ></i>
                                        <span className="text-xs text-gray-700 dark:text-gray-300">
                                        {field.name || "Unnamed Field"}
                                      </span>
                                    <div className="flex items-center gap-1">
                                      {field.mandatory && (
                                        <span
                                              className="w-1.5 h-1.5 bg-red-500 rounded-full"
                                              title="Required"
                                        ></span>
                                      )}
                                      {field.providedByAdmin && (
                                        <span
                                              className="w-1.5 h-1.5 bg-blue-500 rounded-full"
                                          title="Admin Provided"
                                        ></span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              {module.specificFields.length > 3 && (
                                    <div className="relative group">
                                      <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                        +{module.specificFields.length - 3} more
                                      </span>
                                      {/* Tooltip */}
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                        <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl px-3 py-2 min-w-[200px] max-w-[300px] border border-gray-700">
                                          <div className="font-semibold mb-2 pb-2 border-b border-gray-700">
                                            All Fields ({module.specificFields.length}):
                                          </div>
                                          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                            {module.specificFields.map((field, idx) => (
                                              <div key={idx} className="flex items-center gap-2">
                                                <i className={`${getFieldTypeIcon(field.type)} text-xs`}></i>
                                                <span className="flex-1">{field.name || "Unnamed Field"}</span>
                                                <div className="flex items-center gap-1">
                                                  {field.mandatory && (
                                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" title="Required"></span>
                                                  )}
                                                  {field.providedByAdmin && (
                                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" title="Admin Provided"></span>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                          {/* Arrow */}
                                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                            <div className="w-2 h-2 bg-gray-900 dark:bg-gray-800 border-r border-b border-gray-700 rotate-45"></div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  No fields
                                </span>
                        )}
                      </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {canWrite ? (
                              <button
                                onClick={() => openModuleEditModal(index)}
                                className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                title="Edit Module"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-sm">View Only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Shared Fields Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <i className="fas fa-share-alt text-blue-600 dark:text-blue-400"></i>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Shared Fields
                  </h2>
                </div>
              </div>
              {canWrite && (
                <button
                  onClick={openSharedFieldsModal}
                  className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  title="Edit Shared Fields"
                >
                  <i className="fas fa-edit text-sm"></i>
                </button>
              )}
            </div>

            {paymentConfig.sharedFields.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <i className="fas fa-share-alt text-gray-400 text-2xl"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Shared Fields
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Click edit to add shared fields
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Field Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Required
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Options
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {paymentConfig.sharedFields.map((field, index) => (
                        <tr
                        key={index}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                          <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i
                              className={`${getFieldTypeIcon(
                                field.type
                                  )} text-blue-600 dark:text-blue-400 text-sm`}
                            ></i>
                          </div>
                          <div>
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {field.name || "Unnamed Field"}
                          </div>
                        </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                              {field.type} field
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              onClick={() =>
                                handleToggleSharedFieldRequired(index, !field.mandatory)
                              }
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 hover:opacity-80 ${
                                field.mandatory
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                              title={`Click to ${field.mandatory ? "make optional" : "make required"}`}
                            >
                              {field.mandatory ? "Required" : "Optional"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {field.type === "select" && field.options && field.options.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {field.options.map((option, optionIndex) => (
                                  <span
                                    key={optionIndex}
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                                  >
                                    {option}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400 dark:text-gray-500">
                                -
                              </span>
                            )}
                          </td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <i className="fas fa-cog text-blue-600 dark:text-blue-400 text-3xl"></i>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            No Configuration Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {canWrite 
              ? "Create your first payment configuration to get started"
              : "No payment configuration found"}
          </p>
          {canWrite && (
            <button
              onClick={() => {
                setIsEditMode(false);
                setEditingModuleIndex(null);
                setFormData({
                  modules: [],
                  sharedFields: []
                });
                setIsModalOpen(true);
              }}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-3 mx-auto"
            >
              <i className="fas fa-plus text-xl"></i>
              Create Payment Configuration
            </button>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-[900px] max-h-[80vh] transform transition-all duration-300 scale-100 flex flex-col">
            {/* Sticky Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 p-6 pb-4 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                      {isEditMode
                        ? editingModuleIndex !== null
                          ? `Edit ${
                              formData.modules[editingModuleIndex]?.name ||
                              "Module"
                            } Configuration`
                          : "Edit Payment Configuration"
                        : "Create Payment Configuration"}
                    </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-transform duration-200 hover:scale-110"
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
              <div className="space-y-6">
                {/* Shared Fields Section - Only show when not editing a specific module */}
                {editingModuleIndex === null && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    {/* Accordion Header */}
                    <button
                      onClick={() =>
                        setSharedFieldsAccordionOpen(!sharedFieldsAccordionOpen)
                      }
                      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Shared Fields
                          </h3>
                      <div className="flex items-center gap-3">
                        <i
                          className={`fas fa-chevron-${
                            sharedFieldsAccordionOpen ? "up" : "down"
                          } text-gray-600 dark:text-gray-400 transition-transform`}
                        ></i>
                    </div>
                    </button>

                    {/* Accordion Content */}
                    {sharedFieldsAccordionOpen && (
                      <div>
                        <div className="flex items-center justify-end mb-4 px-4 pt-4">
                          <button
                            onClick={() => addSharedField()}
                            className="px-4 py-1.5 bg-[#0071E0] hover:bg-blue-600 text-white rounded-lg text-[13px] flex items-center gap-2 transition duration-200"
                          >
                            <i className="fas fa-plus"></i>
                            Add
                          </button>
                        </div>
                    {formData.sharedFields.length === 0 ? (
                          <div className="p-4">
                            <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                              <p className="text-gray-500 dark:text-gray-400 text-base">
                                No shared fields added yet
                              </p>
                            </div>
                          </div>
                    ) : (
                          <div className="overflow-x-auto w-full my-4">
                            <table className="w-full text-base">
                              <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-600">
                                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Field Name
                                  </th>
                                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Type
                                  </th>
                                  <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Required
                                  </th>
                                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Options
                                  </th>
                                  <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                        {formData.sharedFields.map((field, index) => (
                                  <tr
                            key={index}
                                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/50"
                                  >
                                    <td className="py-2 px-3">
                                    <input
                                      type="text"
                                        className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                      value={field.name}
                                      onChange={(e) =>
                                        updateSharedField(index, {
                                          ...field,
                                          name: e.target.value,
                                        })
                                      }
                                        placeholder="Field name"
                                      />
                                    </td>
                                    <td className="py-2 px-3">
                                    <select
                                        className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                      value={field.type}
                                      onChange={(e) =>
                                        updateSharedField(index, {
                                          ...field,
                                          type: e.target.value as any,
                                        })
                                      }
                                    >
                                      {sharedFieldTypes.map((type) => (
                                        <option key={type} value={type}>
                                          {type.charAt(0).toUpperCase() +
                                            type.slice(1)}
                                        </option>
                                      ))}
                                    </select>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                      checked={field.mandatory}
                                      onChange={(e) =>
                                        updateSharedField(index, {
                                          ...field,
                                          mandatory: e.target.checked,
                                        })
                                      }
                                    />
                                    </td>
                                    <td className="py-2 px-3">
                                      {field.type === "select" ? (
                                    <input
                                      type="text"
                                          className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                      value={field.options?.join(", ") || ""}
                                      onChange={(e) =>
                                        updateSharedField(index, {
                                          ...field,
                                          options: e.target.value
                                            .split(",")
                                            .map((o) => o.trim())
                                            .filter((o) => o),
                                        })
                                      }
                                          placeholder="Option 1, Option 2"
                                        />
                                      ) : (
                                        <span className="text-gray-400 dark:text-gray-500 text-base">
                                          -
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <button
                                        onClick={() => removeSharedField(index)}
                                        className="w-6 h-6 flex items-center justify-center rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                                        title="Remove field"
                                      >
                                        <i className="fas fa-trash text-xs"></i>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Modules Section */}
                {editingModuleIndex === null && (
                      <div>
                    {/* Section Header - Outside Accordion */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Payment Modules
                        </h3>
                      <button
                        onClick={addModule}
                        disabled={allPaymentTypesAdded()}
                        className={`px-4 py-1.5 text-white rounded-lg text-[15px] flex items-center gap-2 transition duration-200 ${
                          allPaymentTypesAdded()
                            ? "bg-gray-400 cursor-not-allowed opacity-50"
                            : "bg-[#0071E0] hover:bg-blue-600"
                        }`}
                        title={
                          allPaymentTypesAdded()
                            ? "All payment types have been added"
                            : "Add new payment module"
                        }
                      >
                        <i className="fas fa-plus"></i>
                        Add Module
                      </button>
                  </div>

                    {/* Accordion Items for Each Payment Type */}
                    <div className="space-y-3">
                      {/* TT Accordion */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setTTAccordionOpen(!ttAccordionOpen)}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                            TT
                      </h4>
                          <i
                            className={`fas fa-chevron-${
                              ttAccordionOpen ? "up" : "down"
                            } text-gray-600 dark:text-gray-400 transition-transform`}
                          ></i>
                        </button>
                        {ttAccordionOpen && (
                          <div>
                            {formData.modules.filter(
                              (m) => m.name === "TT"
                            ).length === 0 ? (
                              <div className="p-4">
                                <div className="text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                                  <p className="text-gray-500 dark:text-gray-400 text-base">
                                    No TT payment module added yet
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {formData.modules
                                  .filter((m) => m.name === "TT")
                                  .map((module) => {
                                    const moduleIndex = formData.modules.indexOf(
                                      module
                                    );
                                    return (
                                      <div key={moduleIndex}>
                                        <div className="p-4">
                                          {/* Module Configuration */}
                                          <div className="flex flex-wrap items-end gap-4 mb-4">
                                            <div className="flex-1 min-w-[200px]">
                                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                Payment Type
                                              </label>
                                              <select
                                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                                value={module.name}
                                                onChange={(e) =>
                                                  updateModule(moduleIndex, {
                                                    ...module,
                                                    name: e.target.value,
                                                  })
                                                }
                                              >
                                                <option value="">
                                                  Select Payment Type
                                                </option>
                                                {paymentTypes.map((type) => (
                                                  <option key={type} value={type}>
                                                    {type}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                            <div className="flex items-center gap-4">
                                              <label className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                                                <input
                                                  type="checkbox"
                                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                                  checked={module.enabled}
                                                  onChange={(e) =>
                                                    updateModule(moduleIndex, {
                                                      ...module,
                                                      enabled: e.target.checked,
                                                    })
                                                  }
                                                />
                                                <span className="ml-2 text-base text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                                  Enable this payment method
                                      </span>
                                              </label>
                                              <label className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                                                <input
                                                  type="checkbox"
                                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                                  checked={module.termsAndConditions}
                                                  onChange={(e) =>
                                                    updateModule(moduleIndex, {
                                                      ...module,
                                                      termsAndConditions:
                                                        e.target.checked,
                                                    })
                                                  }
                                                />
                                                <span className="ml-2 text-base text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                                  Require Terms & Conditions
                                                </span>
                                              </label>
                                    </div>
                                          </div>
                                        </div>

                                          {/* Specific Fields */}
                                          <div>
                                            <div className="flex items-center justify-between mb-4 px-4">
                                              <div className="flex items-center gap-3">
                                                <i className="fas fa-list text-gray-600 dark:text-gray-400"></i>
                                                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                  Specific Fields
                                                </h5>
                                              </div>
                                              <button
                                                onClick={() =>
                                                  addSpecificField(moduleIndex)
                                                }
                                                className="px-4 py-1.5 bg-[#0071E0] hover:bg-blue-600 text-white rounded-lg text-[13px] flex items-center gap-2 transition duration-200"
                                              >
                                                <i className="fas fa-plus"></i>
                                                Add
                                              </button>
                                            </div>

                                            {module.specificFields.length === 0 ? (
                                              <div className="px-4">
                                                <div className="text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                                                  <i className="fas fa-plus-circle text-gray-400 text-xl mb-2"></i>
                                                  <p className="text-gray-500 dark:text-gray-400 text-base">
                                                    No specific fields added yet
                                                  </p>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="overflow-x-auto w-full">
                                                <table className="w-full text-base">
                                                  <thead>
                                                    <tr className="border-b border-gray-200 dark:border-gray-600">
                                                      <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        Field Name
                                                      </th>
                                                      <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        Type
                                                      </th>
                                                      <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        Required
                                                      </th>
                                                      <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        Default Value
                                                      </th>
                                                      <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        Actions
                                                      </th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {module.specificFields.map(
                                                      (field, fieldIndex) => (
                                                        <tr
                                                          key={fieldIndex}
                                                          className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/50"
                                                        >
                                                          <td className="py-2 px-3">
                                                            <input
                                                              type="text"
                                                              className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                                              value={field.name}
                                                              onChange={(e) =>
                                                                updateSpecificField(
                                                                  moduleIndex,
                                                                  fieldIndex,
                                                                  {
                                                                    ...field,
                                                                    name:
                                                                      e.target
                                                                        .value,
                                                                  }
                                                                )
                                                              }
                                                              placeholder="Field name"
                                                            />
                                                          </td>
                                                          <td className="py-2 px-3">
                                                            <select
                                                              className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                                              value={field.type}
                                                              onChange={(e) =>
                                                                updateSpecificField(
                                                                  moduleIndex,
                                                                  fieldIndex,
                                                                  {
                                                                    ...field,
                                                                    type: e.target
                                                                      .value as any,
                                                                  }
                                                                )
                                                              }
                                                            >
                                                              {fieldTypes.map(
                                                                (type) => (
                                                                  <option
                                                                    key={type}
                                                                    value={type}
                                                                  >
                                                                    {type
                                                                      .charAt(0)
                                                                      .toUpperCase() +
                                                                      type.slice(
                                                                        1
                                                                      )}
                                                                  </option>
                                                                )
                                                              )}
                                                            </select>
                                                          </td>
                                                          <td className="py-2 px-3 text-center">
                                                            <input
                                                              type="checkbox"
                                                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                                              checked={
                                                                field.mandatory
                                                              }
                                                              onChange={(e) =>
                                                                updateSpecificField(
                                                                  moduleIndex,
                                                                  fieldIndex,
                                                                  {
                                                                    ...field,
                                                                    mandatory:
                                                                      e.target
                                                                        .checked,
                                                                  }
                                                                )
                                                              }
                                                            />
                                                          </td>
                                                          <td className="py-2 px-3">
                                                            <div className="flex items-center gap-3">
                                                              <label className="flex items-center cursor-pointer">
                                                                <input
                                                                  type="checkbox"
                                                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                                                  checked={
                                                                    field.providedByAdmin ||
                                                                    false
                                                                  }
                                                                  onChange={(e) =>
                                                                    updateSpecificField(
                                                                      moduleIndex,
                                                                      fieldIndex,
                                                                      {
                                                                        ...field,
                                                                        providedByAdmin:
                                                                          e.target
                                                                            .checked,
                                                                      }
                                                                    )
                                                                  }
                                                                />
                                                              </label>
                                                              {field.providedByAdmin ? (
                                                                <input
                                                                  type="text"
                                                                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-base"
                                                                  value={
                                                                    field.value ||
                                                                    ""
                                                                  }
                                                                  onChange={(e) =>
                                                                    updateSpecificField(
                                                                      moduleIndex,
                                                                      fieldIndex,
                                                                      {
                                                                        ...field,
                                                                        value:
                                                                          e.target
                                                                            .value,
                                                                      }
                                                                    )
                                                                  }
                                                                  placeholder="Default value"
                                                                />
                                                              ) : (
                                                                <span className="text-gray-400 dark:text-gray-500 text-base">
                                                                  -
                                                                </span>
                                                              )}
                                  </div>
                                                          </td>
                                                          <td className="py-2 px-3 text-center">
                                    <button
                                                              onClick={() =>
                                                                removeSpecificField(
                                                                  moduleIndex,
                                                                  fieldIndex
                                                                )
                                                              }
                                                              className="w-6 h-6 flex items-center justify-center rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                                                              title="Remove field"
                                                            >
                                                              <i className="fas fa-trash text-xs"></i>
                                    </button>
                                                          </td>
                                                        </tr>
                                                      )
                                                    )}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ThirdParty Accordion */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() =>
                            setThirdPartyAccordionOpen(!thirdPartyAccordionOpen)
                          }
                          className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                            ThirdParty
                          </h4>
                          <i
                            className={`fas fa-chevron-${
                              thirdPartyAccordionOpen ? "up" : "down"
                            } text-gray-600 dark:text-gray-400 transition-transform`}
                          ></i>
                        </button>
                        {thirdPartyAccordionOpen && (
                          <div>
                            {formData.modules.filter(
                              (m) => m.name === "ThirdParty"
                            ).length === 0 ? (
                              <div className="p-4">
                                <div className="text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                                  <p className="text-gray-500 dark:text-gray-400 text-base">
                                    No ThirdParty payment module added yet
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {formData.modules
                                  .filter((m) => m.name === "ThirdParty")
                                  .map((module) => {
                                    const moduleIndex = formData.modules.indexOf(
                                      module
                                    );
                                    return (
                                      <div key={moduleIndex}>
                                      <div className="p-4">
                                {/* Module Configuration */}
                                        <div className="flex flex-wrap items-end gap-4 mb-4">
                                          <div className="flex-1 min-w-[200px]">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                      Payment Type
                                    </label>
                                    <select
                                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      value={module.name}
                                      onChange={(e) =>
                                        updateModule(moduleIndex, {
                                          ...module,
                                          name: e.target.value,
                                        })
                                      }
                                    >
                                      <option value="">
                                        Select Payment Type
                                      </option>
                                      {paymentTypes.map((type) => (
                                        <option key={type} value={type}>
                                          {type}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                          <div className="flex items-center gap-4">
                                            <label className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                                      <input
                                        type="checkbox"
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                        checked={module.enabled}
                                        onChange={(e) =>
                                          updateModule(moduleIndex, {
                                            ...module,
                                            enabled: e.target.checked,
                                          })
                                        }
                                      />
                                              <span className="ml-2 text-base text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                        Enable this payment method
                                      </span>
                                    </label>
                                            <label className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                                      <input
                                        type="checkbox"
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                        checked={module.termsAndConditions}
                                        onChange={(e) =>
                                          updateModule(moduleIndex, {
                                            ...module,
                                            termsAndConditions:
                                              e.target.checked,
                                          })
                                        }
                                      />
                                              <span className="ml-2 text-base text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                        Require Terms & Conditions
                                      </span>
                                    </label>
                                  </div>
                                </div>
                                      </div>

                                {/* Specific Fields */}
                                <div>
                                  <div className="flex items-center justify-between mb-4 px-4">
                                    <div className="flex items-center gap-3">
                                      <i className="fas fa-list text-gray-600 dark:text-gray-400"></i>
                                              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Specific Fields
                                      </h5>
                                    </div>
                                    <button
                                      onClick={() =>
                                        addSpecificField(moduleIndex)
                                      }
                                              className="px-4 py-1.5 bg-[#0071E0] hover:bg-blue-600 text-white rounded-lg text-[13px] flex items-center gap-2 transition duration-200"
                                    >
                                      <i className="fas fa-plus"></i>
                                              Add
                                    </button>
                                  </div>

                                  {module.specificFields.length === 0 ? (
                                    <div className="px-4">
                                      <div className="text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                                        <i className="fas fa-plus-circle text-gray-400 text-xl mb-2"></i>
                                              <p className="text-gray-500 dark:text-gray-400 text-base">
                                        No specific fields added yet
                                      </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto w-full">
                                              <table className="w-full text-base">
                                        <thead>
                                          <tr className="border-b border-gray-200 dark:border-gray-600">
                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                              Field Name
                                            </th>
                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                              Type
                                            </th>
                                                    <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                              Required
                                            </th>
                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                              Default Value
                                            </th>
                                                    <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                              Actions
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {module.specificFields.map(
                                            (field, fieldIndex) => (
                                              <tr
                                                key={fieldIndex}
                                                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/50"
                                              >
                                                <td className="py-2 px-3">
                                                  <input
                                                    type="text"
                                                            className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                                    value={field.name}
                                                    onChange={(e) =>
                                                      updateSpecificField(
                                                        moduleIndex,
                                                        fieldIndex,
                                                        {
                                                          ...field,
                                                                  name:
                                                                    e.target
                                                                      .value,
                                                        }
                                                      )
                                                    }
                                                    placeholder="Field name"
                                                  />
                                                </td>
                                                <td className="py-2 px-3">
                                                  <select
                                                            className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                                    value={field.type}
                                                    onChange={(e) =>
                                                      updateSpecificField(
                                                        moduleIndex,
                                                        fieldIndex,
                                                        {
                                                          ...field,
                                                          type: e.target
                                                            .value as any,
                                                        }
                                                      )
                                                    }
                                                  >
                                                            {fieldTypes.map(
                                                              (type) => (
                                                      <option
                                                        key={type}
                                                        value={type}
                                                      >
                                                        {type
                                                          .charAt(0)
                                                          .toUpperCase() +
                                                                    type.slice(
                                                                      1
                                                                    )}
                                                      </option>
                                                              )
                                                            )}
                                                  </select>
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                  <input
                                                    type="checkbox"
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                                            checked={
                                                              field.mandatory
                                                            }
                                                    onChange={(e) =>
                                                      updateSpecificField(
                                                        moduleIndex,
                                                        fieldIndex,
                                                        {
                                                          ...field,
                                                          mandatory:
                                                                    e.target
                                                                      .checked,
                                                        }
                                                      )
                                                    }
                                                  />
                                                </td>
                                                        <td className="py-2 px-3">
                                                          <div className="flex items-center gap-3">
                                                            <label className="flex items-center cursor-pointer">
                                                  <input
                                                    type="checkbox"
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                                    checked={
                                                      field.providedByAdmin ||
                                                      false
                                                    }
                                                    onChange={(e) =>
                                                      updateSpecificField(
                                                        moduleIndex,
                                                        fieldIndex,
                                                        {
                                                          ...field,
                                                          providedByAdmin:
                                                                        e.target
                                                                          .checked,
                                                                    }
                                                                  )
                                                                }
                                                              />
                                                            </label>
                                                            {field.providedByAdmin ? (
                                                              <input
                                                                type="text"
                                                                className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-base"
                                                                value={
                                                                  field.value ||
                                                                  ""
                                                                }
                                                                onChange={(e) =>
                                                                  updateSpecificField(
                                                                    moduleIndex,
                                                                    fieldIndex,
                                                                    {
                                                                      ...field,
                                                                      value:
                                                                        e.target
                                                                          .value,
                                                                    }
                                                                  )
                                                                }
                                                                placeholder="Default value"
                                                              />
                                                            ) : (
                                                              <span className="text-gray-400 dark:text-gray-500 text-base">
                                                                -
                                                              </span>
                                                            )}
                                                          </div>
                                                        </td>
                                                        <td className="py-2 px-3 text-center">
                                                          <button
                                                            onClick={() =>
                                                              removeSpecificField(
                                                                moduleIndex,
                                                                fieldIndex
                                                              )
                                                            }
                                                            className="w-6 h-6 flex items-center justify-center rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                                                            title="Remove field"
                                                          >
                                                            <i className="fas fa-trash text-xs"></i>
                                                          </button>
                                                        </td>
                                                      </tr>
                                                    )
                                                  )}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Cash Accordion */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() =>
                            setCashAccordionOpen(!cashAccordionOpen)
                          }
                          className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                            Cash
                          </h4>
                          <i
                            className={`fas fa-chevron-${
                              cashAccordionOpen ? "up" : "down"
                            } text-gray-600 dark:text-gray-400 transition-transform`}
                          ></i>
                        </button>
                        {cashAccordionOpen && (
                          <div>
                            {formData.modules.filter(
                              (m) => m.name === "Cash"
                            ).length === 0 ? (
                              <div className="p-4">
                                <div className="text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                                  <p className="text-gray-500 dark:text-gray-400 text-base">
                                    No Cash payment module added yet
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {formData.modules
                                  .filter((m) => m.name === "Cash")
                                  .map((module) => {
                                    const moduleIndex = formData.modules.indexOf(
                                      module
                                    );
                                    return (
                                      <div key={moduleIndex}>
                                      <div className="p-4">
                                        {/* Module Configuration */}
                                        <div className="flex flex-wrap items-end gap-4 mb-4">
                                          <div className="flex-1 min-w-[200px]">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                              Payment Type
                                            </label>
                                            <select
                                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                              value={module.name}
                                              onChange={(e) =>
                                                updateModule(moduleIndex, {
                                                  ...module,
                                                  name: e.target.value,
                                                })
                                              }
                                            >
                                              <option value="">
                                                Select Payment Type
                                              </option>
                                              {paymentTypes.map((type) => (
                                                <option key={type} value={type}>
                                                  {type}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="flex items-center gap-4">
                                            <label className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                                              <input
                                                type="checkbox"
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                                checked={module.enabled}
                                                onChange={(e) =>
                                                  updateModule(moduleIndex, {
                                                    ...module,
                                                    enabled: e.target.checked,
                                                  })
                                                }
                                              />
                                              <span className="ml-2 text-base text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                                Enable this payment method
                                              </span>
                                            </label>
                                            <label className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                                              <input
                                                type="checkbox"
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                                checked={module.termsAndConditions}
                                                onChange={(e) =>
                                                  updateModule(moduleIndex, {
                                                    ...module,
                                                    termsAndConditions:
                                                            e.target.checked,
                                                  })
                                                }
                                              />
                                              <span className="ml-2 text-base text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                                Require Terms & Conditions
                                              </span>
                                            </label>
                                          </div>
                                        </div>
                                      </div>

                                        {/* Specific Fields */}
                                        <div>
                                          <div className="flex items-center justify-between mb-4 px-4">
                                            <div className="flex items-center gap-3">
                                              <i className="fas fa-list text-gray-600 dark:text-gray-400"></i>
                                              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                Specific Fields
                                              </h5>
                                            </div>
                                            <button
                                              onClick={() =>
                                                addSpecificField(moduleIndex)
                                              }
                                              className="px-4 py-1.5 bg-[#0071E0] hover:bg-blue-600 text-white rounded-lg text-[13px] flex items-center gap-2 transition duration-200"
                                            >
                                              <i className="fas fa-plus"></i>
                                              Add
                                            </button>
                                          </div>

                                          {module.specificFields.length === 0 ? (
                                            <div className="px-4">
                                              <div className="text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                                                <i className="fas fa-plus-circle text-gray-400 text-xl mb-2"></i>
                                                <p className="text-gray-500 dark:text-gray-400 text-base">
                                                  No specific fields added yet
                                                </p>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="overflow-x-auto w-full">
                                              <table className="w-full text-base">
                                                <thead>
                                                  <tr className="border-b border-gray-200 dark:border-gray-600">
                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                      Field Name
                                                    </th>
                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                      Type
                                                    </th>
                                                    <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                      Required
                                                    </th>
                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                      Default Value
                                                    </th>
                                                    <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                      Actions
                                                    </th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {module.specificFields.map(
                                                    (field, fieldIndex) => (
                                                      <tr
                                                        key={fieldIndex}
                                                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/50"
                                                      >
                                                        <td className="py-2 px-3">
                                                          <input
                                                            type="text"
                                                            className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                                            value={field.name}
                                                            onChange={(e) =>
                                                              updateSpecificField(
                                                                moduleIndex,
                                                                fieldIndex,
                                                                {
                                                                  ...field,
                                                                  name:
                                                                    e.target
                                                                      .value,
                                                                }
                                                              )
                                                            }
                                                            placeholder="Field name"
                                                  />
                                                </td>
                                                <td className="py-2 px-3">
                                                          <select
                                                            className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                                            value={field.type}
                                                            onChange={(e) =>
                                                              updateSpecificField(
                                                                moduleIndex,
                                                                fieldIndex,
                                                                {
                                                                  ...field,
                                                                  type: e.target
                                                                    .value as any,
                                                                }
                                                              )
                                                            }
                                                          >
                                                            {fieldTypes.map(
                                                              (type) => (
                                                                <option
                                                                  key={type}
                                                                  value={type}
                                                                >
                                                                  {type
                                                                    .charAt(0)
                                                                    .toUpperCase() +
                                                                    type.slice(
                                                                      1
                                                                    )}
                                                                </option>
                                                              )
                                                            )}
                                                          </select>
                                                        </td>
                                                        <td className="py-2 px-3 text-center">
                                                          <input
                                                            type="checkbox"
                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                                            checked={
                                                              field.mandatory
                                                            }
                                                            onChange={(e) =>
                                                              updateSpecificField(
                                                                moduleIndex,
                                                                fieldIndex,
                                                                {
                                                                  ...field,
                                                                  mandatory:
                                                                    e.target
                                                                      .checked,
                                                                }
                                                              )
                                                            }
                                                          />
                                                        </td>
                                                        <td className="py-2 px-3">
                                                          <div className="flex items-center gap-3">
                                                            <label className="flex items-center cursor-pointer">
                                                              <input
                                                                type="checkbox"
                                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                                                checked={
                                                                  field.providedByAdmin ||
                                                                  false
                                                                }
                                                                onChange={(e) =>
                                                                  updateSpecificField(
                                                                    moduleIndex,
                                                                    fieldIndex,
                                                                    {
                                                                      ...field,
                                                                      providedByAdmin:
                                                                        e.target
                                                                          .checked,
                                                                    }
                                                                  )
                                                                }
                                                              />
                                                            </label>
                                                  {field.providedByAdmin ? (
                                                    <input
                                                      type="text"
                                                                className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-base"
                                                                value={
                                                                  field.value ||
                                                                  ""
                                                                }
                                                      onChange={(e) =>
                                                        updateSpecificField(
                                                          moduleIndex,
                                                          fieldIndex,
                                                          {
                                                            ...field,
                                                            value:
                                                                        e.target
                                                                          .value,
                                                          }
                                                        )
                                                      }
                                                      placeholder="Default value"
                                                    />
                                                  ) : (
                                                              <span className="text-gray-400 dark:text-gray-500 text-base">
                                                      -
                                                    </span>
                                                  )}
                                                          </div>
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                  <button
                                                    onClick={() =>
                                                      removeSpecificField(
                                                        moduleIndex,
                                                        fieldIndex
                                                      )
                                                    }
                                                    className="w-6 h-6 flex items-center justify-center rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                                                    title="Remove field"
                                                  >
                                                    <i className="fas fa-trash text-xs"></i>
                                                  </button>
                                                </td>
                                              </tr>
                                            )
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {editingModuleIndex !== null && formData.modules[editingModuleIndex] && (
                  // Direct module editing - show module configuration without outer wrapper
                  <>
                        {/* Module Configuration */}
                        <div className="flex flex-wrap items-end gap-4 mb-4">
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Payment Type
                            </label>
                            <select
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              value={formData.modules[editingModuleIndex!].name}
                              onChange={(e) =>
                                updateModule(editingModuleIndex!, {
                                  ...formData.modules[editingModuleIndex!],
                                  name: e.target.value,
                                })
                              }
                            >
                              <option value="">
                                Select Payment Type
                              </option>
                              {paymentTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                checked={formData.modules[editingModuleIndex!].enabled}
                                onChange={(e) =>
                                  updateModule(editingModuleIndex!, {
                                    ...formData.modules[editingModuleIndex!],
                                    enabled: e.target.checked,
                                  })
                                }
                              />
                              <span className="ml-2 text-base text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                Enable this payment method
                              </span>
                            </label>
                            <label className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                checked={formData.modules[editingModuleIndex!].termsAndConditions}
                                onChange={(e) =>
                                  updateModule(editingModuleIndex!, {
                                    ...formData.modules[editingModuleIndex!],
                                    termsAndConditions: e.target.checked,
                                  })
                                }
                              />
                              <span className="ml-2 text-base text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                Require Terms & Conditions
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Specific Fields */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Specific Fields
                            </h3>
                            <button
                              onClick={() => addSpecificField(editingModuleIndex!)}
                              className="px-4 py-1.5 bg-[#0071E0] hover:bg-blue-600 text-white rounded-lg text-[13px] flex items-center gap-2 transition duration-200"
                            >
                              <i className="fas fa-plus"></i>
                              Add 
                            </button>
                          </div>

                          {formData.modules[editingModuleIndex!].specificFields.length === 0 ? (
                            <div className="text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                              <p className="text-gray-500 dark:text-gray-400 text-base">
                                No specific fields added yet
                              </p>
                            </div>
                          ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                              <div className="overflow-x-auto">
                                <table className="w-full text-base">
                                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                                    <tr>
                                      <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Field Name
                                      </th>
                                      <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Type
                                      </th>
                                      <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Required
                                      </th>
                                      <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Default Value
                                      </th>
                                      <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {formData.modules[editingModuleIndex!].specificFields.map(
                                      (field: SpecificField, fieldIndex: number) => (
                                        <tr
                                          key={fieldIndex}
                                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                        >
                                        <td className="py-2 px-3">
                                          <input
                                            type="text"
                                            className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                            value={field.name}
                                            onChange={(e) =>
                                              updateSpecificField(
                                                editingModuleIndex!,
                                                fieldIndex,
                                                {
                                                  ...field,
                                                  name: e.target.value,
                                                }
                                              )
                                            }
                                            placeholder="Field name"
                                          />
                                        </td>
                                        <td className="py-2 px-3">
                                          <select
                                            className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                            value={field.type}
                                            onChange={(e) =>
                                              updateSpecificField(
                                                editingModuleIndex!,
                                                fieldIndex,
                                                {
                                                  ...field,
                                                  type: e.target.value as any,
                                                }
                                              )
                                            }
                                          >
                                            {fieldTypes.map((type) => (
                                              <option key={type} value={type}>
                                                {type
                                                  .charAt(0)
                                                  .toUpperCase() +
                                                  type.slice(1)}
                                              </option>
                                            ))}
                                          </select>
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                            checked={field.mandatory}
                                            onChange={(e) =>
                                              updateSpecificField(
                                                editingModuleIndex!,
                                                fieldIndex,
                                                {
                                                  ...field,
                                                  mandatory: e.target.checked,
                                                }
                                              )
                                            }
                                          />
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className="flex items-center gap-3">
                                            <label className="flex items-center cursor-pointer">
                                              <input
                                                type="checkbox"
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                                checked={field.providedByAdmin || false}
                                                onChange={(e) =>
                                                  updateSpecificField(
                                                    editingModuleIndex!,
                                                    fieldIndex,
                                                    {
                                                      ...field,
                                                      providedByAdmin: e.target.checked,
                                                    }
                                                  )
                                                }
                                              />
                                            </label>
                                            {field.providedByAdmin ? (
                                              <input
                                                type="text"
                                                className="flex-1 border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                                value={field.value || ""}
                                                onChange={(e) =>
                                                  updateSpecificField(
                                                    editingModuleIndex!,
                                                    fieldIndex,
                                                    {
                                                      ...field,
                                                      value: e.target.value,
                                                    }
                                                  )
                                                }
                                                placeholder="Default value"
                                              />
                                            ) : (
                                              <span className="text-gray-400 dark:text-gray-500 text-base">
                                                -
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          <button
                                            onClick={() =>
                                              removeSpecificField(
                                                editingModuleIndex!,
                                                fieldIndex
                                              )
                                            }
                                            className="w-6 h-6 flex items-center justify-center rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                                            title="Remove field"
                                          >
                                            <i className="fas fa-trash text-xs"></i>
                                          </button>
                                        </td>
                                      </tr>
                                    )
                                  )}
                                </tbody>
                              </table>
                              </div>
                            </div>
                          )}
                        </div>
                  </>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-900 p-6 pt-4 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 text-base"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddEditConfig}
                  className="px-4 py-1.5 bg-[#0071E0] text-white rounded-lg hover:bg-blue-600 transition duration-200 text-base flex items-center justify-center"
                >
                  {isEditMode ? "Update " : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shared Fields Modal */}
      {isSharedFieldsModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-[900px] max-h-[80vh] transform transition-all duration-300 scale-100 flex flex-col">
            {/* Sticky Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 p-6 pb-4 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                      Edit Shared Fields
                    </h2>
                <button
                  type="button"
                  onClick={() => setIsSharedFieldsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-transform duration-200 hover:scale-110"
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
              <div className="space-y-4">
                {/* Shared Fields Section */}
                      <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Shared Fields
                        </h3>
                    <button
                      onClick={addSharedField}
                                      className="px-4 py-1.5 bg-[#0071E0] hover:bg-blue-600 text-white rounded-lg text-[13px] flex items-center gap-2 transition duration-200"
                    >
                      <i className="fas fa-plus"></i>
                      Add 
                    </button>
                  </div>

                  {formData.sharedFields.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                      <p className="text-gray-500 dark:text-gray-400 text-base">
                        No shared fields added yet
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-base">
                          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                            <tr>
                              <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Field Name
                              </th>
                              <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Type
                              </th>
                              <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Required
                              </th>
                              <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Options
                              </th>
                              <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {formData.sharedFields.map((field, index) => (
                              <tr
                            key={index}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                              >
                              <td className="py-2 px-3">
                                  <input
                                    type="text"
                                  className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                    value={field.name}
                                    onChange={(e) =>
                                      updateSharedField(index, {
                                        ...field,
                                        name: e.target.value,
                                      })
                                    }
                                  placeholder="Field name"
                                />
                              </td>
                              <td className="py-2 px-3">
                                  <select
                                  className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                    value={field.type}
                                    onChange={(e) =>
                                      updateSharedField(index, {
                                        ...field,
                                        type: e.target.value as any,
                                      })
                                    }
                                  >
                                    {sharedFieldTypes.map((type) => (
                                      <option key={type} value={type}>
                                        {type.charAt(0).toUpperCase() +
                                          type.slice(1)}
                                      </option>
                                    ))}
                                  </select>
                              </td>
                              <td className="py-2 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                    checked={field.mandatory}
                                    onChange={(e) =>
                                      updateSharedField(index, {
                                        ...field,
                                        mandatory: e.target.checked,
                                      })
                                    }
                                  />
                              </td>
                              <td className="py-2 px-3">
                                {field.type === "select" ? (
                                  <input
                                    type="text"
                                    className="w-full border border-gray-200 dark:border-gray-500 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[15px]"
                                    value={field.options?.join(", ") || ""}
                                    onChange={(e) =>
                                      updateSharedField(index, {
                                        ...field,
                                        options: e.target.value
                                          .split(",")
                                          .map((o) => o.trim())
                                          .filter((o) => o),
                                      })
                                    }
                                    placeholder="Option 1, Option 2"
                                  />
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500 text-base">
                                    -
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => removeSharedField(index)}
                                  className="w-6 h-6 flex items-center justify-center rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                                  title="Remove field"
                                >
                                  <i className="fas fa-trash text-xs"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-900 p-6 pt-4 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSharedFieldsModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 text-base"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddEditConfig}
                  className="px-4 py-1.5 bg-[#0071E0] text-white rounded-lg hover:bg-blue-600 transition duration-200 text-base flex items-center justify-center"
                >
                  Update 
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentConfig;
