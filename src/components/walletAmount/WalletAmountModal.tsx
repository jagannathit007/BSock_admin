import React, { useState, useEffect } from "react";
import Select from "react-select";
import {
  walletAmountService,
  ManageWalletRequest,
  CustomerWalletData,
} from "../../services/walletAmount/walletAmountService";
import {
  CustomerService,
  Customer,
} from "../../services/customer/customerService";
import toastHelper from "../../utils/toastHelper";

// Define the interface for Transaction data
interface Transaction {
  _id: string;
  customerId: string;
  customerName: string;
  type: "credit" | "debit";
  amount: number;
  remark: string;
  createdAt: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
}

// Define the interface for form data
interface FormData {
  customerId: string;
  type: "credit" | "debit";
  amount: string;
  remark: string;
}

interface WalletAmountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void; // Changed to void since we'll refresh data after save
  editItem?: Transaction;
  editCustomer?: CustomerWalletData | null;
}

const WalletAmountModal: React.FC<WalletAmountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editItem,
  editCustomer,
}) => {
  const [formData, setFormData] = useState<FormData>({
    customerId: "",
    type: "credit",
    amount: "",
    remark: "",
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Convert customers array to react-select options
  const customerOptions = customers.map((c) => ({
    label: `${c.name} (${c.email})`,
    value: c._id,
  }));

  // Fetch customers when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      if (editItem) {
        // Editing a transaction
        setFormData({
          customerId: editItem.customerId,
          type: editItem.type,
          amount: editItem.amount.toString(),
          remark: editItem.remark,
        });
      } else if (editCustomer) {
        // Editing customer wallet - pre-fill customer ID
        setFormData({
          customerId: editCustomer._id,
          type: "credit",
          amount: "",
          remark: "",
        });
      } else {
        // Creating new transaction
        setFormData({
          customerId: "",
          type: "credit",
          amount: "",
          remark: "",
        });
      }
    }
  }, [isOpen, editItem, editCustomer]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const customerList = await CustomerService.getAllCustomers();
      setCustomers(customerList);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      toastHelper.showTost("Failed to fetch customers", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCustomerChange = (option: any) => {
    setFormData((prev) => ({
      ...prev,
      customerId: option ? option.value : "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.customerId || !formData.amount) {
      toastHelper.showTost("Please fill in all required fields", "error");
      return;
    }

    try {
      setSubmitting(true);
      const requestData: ManageWalletRequest = {
        customerId: formData.customerId,
        amount: parseFloat(formData.amount),
        type: formData.type as "credit" | "debit",
        remark: formData.remark,
      };

      await walletAmountService.manageWallet(requestData);

      const action = formData.type === "credit" ? "added to" : "deducted from";
      toastHelper.showTost(`Amount ${action} wallet successfully!`, "success");

      onSave(); // Refresh the parent component data
      onClose();
    } catch (error: any) {
      console.error("Failed to manage wallet:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to manage wallet";
      toastHelper.showTost(errorMessage, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const title = editItem
    ? "Edit Transaction"
    : editCustomer
    ? "Manage Wallet"
    : "Create Transaction";

  // Custom styles for react-select (matching your design)
  const customSelectStyles = {
    control: (defaultStyles: any, state: any) => ({
      ...defaultStyles,
      display: "flex",
      alignItems: "center",
      minHeight: "48px",
      padding: "2px 6px",
      backgroundColor: "var(--tw-colors-gray-50)",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: state.isFocused ? "#3b82f6" : "#d1d5db", // blue-500 on focus, gray-300 otherwise
      borderRadius: "0.5rem",
      boxShadow: state.isFocused ? "0 0 0 1px #3b82f6" : "none",
      transition: "all 0.2s ease",
      "&:hover": {
        borderColor: "#9ca3af", // gray-400 on hover
      },
    }),
    placeholder: (defaultStyles: any) => ({
      ...defaultStyles,
      color: "#6b7280", // gray-500
    }),
    singleValue: (defaultStyles: any) => ({
      ...defaultStyles,
      color: "#1f2937", // gray-800
    }),
    menu: (defaultStyles: any) => ({
      ...defaultStyles,
      borderRadius: "0.5rem",
      marginTop: "4px",
      zIndex: 20,
      border: "1px solid #d1d5db", // gray-300
    }),
    option: (defaultStyles: any, state: any) => ({
      ...defaultStyles,
      backgroundColor: state.isSelected
        ? "#3b82f6"
        : state.isFocused
        ? "#e6f0ff"
        : "white",
      color: state.isSelected ? "white" : "#1f2937",
      cursor: "pointer",
    }),
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-[800px] max-h-[88vh] overflow-y-auto transform transition-all duration-300 scale-100 relative">
        {/* Close Icon */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-transform duration-200 hover:scale-110"
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

        <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-8">
          {title}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Customer and Type Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-base font-medium text-gray-950 dark:text-gray-200 mb-2">
                Customer
              </label>
              {editCustomer ? (
                <div className="w-full p-3 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200">
                  {editCustomer.name} (
                  {editCustomer.mobileNumber || "No mobile"})
                </div>
              ) : (
                <Select
                  options={customerOptions}
                  value={
                    formData.customerId
                      ? customerOptions.find(
                          (option) => option.value === formData.customerId
                        )
                      : null
                  }
                  onChange={handleCustomerChange}
                  placeholder={
                    loading ? "Loading customers..." : "Select Customer"
                  }
                  isClearable
                  isSearchable
                  isLoading={loading}
                  styles={customSelectStyles}
                />
              )}
            </div>
            <div>
              <label className="block text-base font-medium text-gray-950 dark:text-gray-200 mb-2">
                Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                required
              >
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-base font-medium text-gray-950 dark:text-gray-200 mb-2">
              Amount
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
              placeholder="Enter Amount"
              required
              step="0.01"
            />
          </div>

          {/* Remark */}
          <div>
            <label className="block text-base font-medium text-gray-950 dark:text-gray-200 mb-2">
              Remark
            </label>
            <textarea
              name="remark"
              value={formData.remark}
              onChange={handleInputChange}
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
              placeholder="Enter Remark"
              rows={4}
              required
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 transform hover:scale-105"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-w-[180px] px-6 py-2.5 bg-[#0071E0] text-white rounded-lg hover:bg-blue-600 transition duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
            >
              {submitting ? (
                <svg
                  className="animate-spin h-5 w-5 text-white"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 
           0 5.373 0 12h4zm2 5.291A7.962 
           7.962 0 014 12H0c0 3.042 1.135 
           5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : editItem ? (
                "Update Transaction"
              ) : (
                "Create Transaction"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WalletAmountModal;
