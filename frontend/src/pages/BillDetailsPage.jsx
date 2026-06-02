import { useCallback, useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import axios from "axios";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BillDetailsPage = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { backendUrl, token, userData } = useContext(AppContext);

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);

  const months = [
    " ", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const formatDate = (slotDate) => {
    if (!slotDate) return "-";
    const [day, month, year] = slotDate.split("_");
    return `${day} ${months[Number(month)]} ${year}`;
  };

  const formatStatus = (appointment) => {
    if (appointment.cancelled) return "CANCELLED";
    if (appointment.isCompleted) return "COMPLETED";
    if (appointment.payment) return "PAID";
    return "PENDING";
  };

  const statusColor = (status) => {
    switch (status) {
      case "PAID":
      case "COMPLETED":
        return "bg-green-100 text-green-700 border border-green-300";
      case "CANCELLED":
        return "bg-red-100 text-red-700 border border-red-300";
      default:
        return "bg-yellow-100 text-yellow-700 border border-yellow-300";
    }
  };

  // Fetch appointment
  const fetchBill = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.post(backendUrl + "/api/user/appointments", {}, {
        headers: { token },
      });
      if (data.success) {
        const found = data.appointments.find((a) => a._id === appointmentId);
        if (found) {
          setBill(found);
        } else {
          toast.error("Appointment not found");
          navigate("/my-appointments");
        }
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.log(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [appointmentId, backendUrl, navigate, token]);

  useEffect(() => {
    if (token && appointmentId) fetchBill();
  }, [token, appointmentId, fetchBill]);

  // Razorpay Payment
  const payWithRazorpay = async () => {
    try {
      const { data } = await axios.post(
        backendUrl + "/api/user/payment-razorpay",
        { appointmentId: bill._id },
        { headers: { token } },
      );
      if (data.success) {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: data.order.amount,
          currency: data.order.currency,
          name: "Appointy",
          description: `Appointment with ${bill.docData?.name}`,
          order_id: data.order.id,
          handler: async (response) => {
            try {
              const verifyRes = await axios.post(
                backendUrl + "/api/user/verifyRazorpay",
                response,
                { headers: { token } },
              );
              if (verifyRes.data.success) {
                toast.success("Payment successful!");
                fetchBill();
              }
            } catch {
              toast.error("Payment verification failed");
            }
          },
          prefill: {
            name: userData?.name || "",
            email: userData?.email || "",
            contact: userData?.phone || "",
          },
          theme: { color: "#5F6FFF" },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.log(error);
      toast.error(error.message);
    }
  };

  // PDF Download
  const downloadPdf = () => {
    if (!bill) return;
    const doc = new jsPDF();
    const status = formatStatus(bill);
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFillColor(95, 111, 255);
    doc.rect(0, 0, pageWidth, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Appointy", pageWidth / 2, 16, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Appointment Bill Receipt", pageWidth / 2, 26, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 34, { align: "center" });

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.text(`Bill ID: ${bill._id}`, 14, 50);
    doc.text(`Status: ${status}`, pageWidth - 14, 50, { align: "right" });

    // Patient Info
    autoTable(doc, {
      startY: 58,
      theme: "grid",
      head: [["Patient Information", " "]],
      body: [
        ["Patient Name", userData?.name || "-"],
        ["Email", userData?.email || "-"],
        ["Phone", userData?.phone || "-"],
      ],
      headStyles: { fillColor: [95, 111, 255], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 246, 255] },
      styles: { fontSize: 10 },
    });

    // Appointment Details
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Appointment Details", ""]],
      body: [
        ["Doctor Name", bill.docData?.name || "-"],
        ["Speciality", bill.docData?.speciality || "-"],
        ["Degree", bill.docData?.degree || "-"],
        ["Address", `${bill.docData?.address?.line1 || ""} ${bill.docData?.address?.line2 || ""}`.trim() || "-"],
        ["Appointment Date", formatDate(bill.slotDate)],
        ["Appointment Time", bill.slotTime || "-"],
      ],
      headStyles: { fillColor: [95, 111, 255], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 246, 255] },
      styles: { fontSize: 10 },
    });

    // Amount
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Description", "Amount (Rs.)"]],
      body: [
        ["Consultation Fee", `Rs. ${bill.docData?.fees?.toFixed(2) || "0.00"}`],
        ["Discount", "Rs. 0.00"],
        ["Total Amount", `Rs. ${bill.docData?.fees?.toFixed(2) || "0.00"}`],
      ],
      headStyles: { fillColor: [95, 111, 255], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 246, 255] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { halign: "left", cellWidth: 120 },
        1: { halign: "right", cellWidth: 60 },
      },
    });

    // Payment Info
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Payment Information", ""]],
      body: [
        ["Payment Method", bill.payment ? "Razorpay" : "Not Paid"],
        ["Payment Status", status],
      ],
      headStyles: { fillColor: [95, 111, 255], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 246, 255] },
      styles: { fontSize: 10 },
    });

    // Refund Info (only if cancelled and paid)
    if (bill.cancelled && bill.payment) {
      const refundLabel =
        bill.refundStatus === "full" ? "Full Refund (100%)" :
        bill.refundStatus === "partial_70" ? "Partial Refund (70%)" :
        bill.refundStatus === "partial_50" ? "Partial Refund (50%)" :
        bill.refundStatus === "no_refund" ? "No Refund" : "-";

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        theme: "grid",
        head: [["Refund Information", ""]],
        body: [
          ["Refund Status", refundLabel],
          ["Refund Amount", `Rs. ${bill.refundAmount?.toFixed(2) || "0.00"}`],
          ["Refund ID", bill.refundId || "Processing..."],
        ],
        headStyles: { fillColor: [95, 111, 255], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 246, 255] },
        styles: { fontSize: 10 },
      });
    }

    // Cancellation Policy in PDF
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Cancellation & Refund Policy", ""]],
      body: [
        ["Before 48 hours", "100% Full Refund"],
        ["Between 24–48 hours", "70% Refund (30% fee)"],
        ["Between 12–24 hours", "50% Refund (50% fee)"],
        ["Within 6 hours", "No Refund"],
        ["Processing Time", "5–7 business days"],
      ],
      headStyles: { fillColor: [95, 111, 255], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 246, 255] },
      styles: { fontSize: 10 },
    });

    // Status badge
    const finalY = doc.lastAutoTable.finalY + 12;
    const isPaid = status === "PAID" || status === "COMPLETED";
    doc.setFillColor(isPaid ? 34 : 220, isPaid ? 197 : 53, isPaid ? 94 : 69);
    doc.roundedRect(pageWidth / 2 - 20, finalY, 40, 10, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(status, pageWidth / 2, finalY + 7, { align: "center" });

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Thank you for choosing Appointy — Effortless Healthcare Scheduling",
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" },
    );

    doc.save(`appointy-bill-${bill._id}.pdf`);
    toast.success("Bill downloaded!");
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading bill...</p>
        </div>
      </div>
    );
  }

  if (!bill) return null;

  const status = formatStatus(bill);
  const isPending = status === "PENDING";

  return (
    <div className="min-h-screen bg-[#f7f8ff] py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-all"
          >
            ← Back
          </button>
          <div className="flex gap-3">
            {isPending && (
              <button
                onClick={payWithRazorpay}
                className="flex items-center gap-2 bg-[#2563EB] text-white text-sm px-5 py-2 rounded-full hover:scale-105 transition-all duration-300"
              >
                💳 Pay with Razorpay
              </button>
            )}
            <button
              onClick={downloadPdf}
              className="flex items-center gap-2 bg-primary text-white text-sm px-5 py-2 rounded-full hover:scale-105 transition-all duration-300"
            >
              ⬇ Download PDF
            </button>
          </div>
        </div>

        {/* Bill Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">

          {/* Card Header */}
          <div className="bg-primary px-8 py-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Appointy</h1>
                <p className="text-blue-100 text-sm mt-0.5">Appointment Bill Receipt</p>
              </div>
              <span className={`text-xs font-semibold px-4 py-1.5 rounded-full ${
                status === "PAID" || status === "COMPLETED" ? "bg-green-400 text-white" :
                status === "CANCELLED" ? "bg-red-400 text-white" :
                "bg-yellow-400 text-gray-800"
              }`}>
                {status}
              </span>
            </div>
            <p className="text-blue-200 text-xs mt-4">Bill ID: {bill._id}</p>
          </div>

          <div className="px-8 py-6 space-y-6">

            {/* Patient Info */}
            <Section title="Patient Information">
              <div className="bg-[#f5f6ff] rounded-xl p-4 space-y-2">
                <Row label="Patient Name" value={userData?.name || "-"} />
                <Row label="Email" value={userData?.email || "-"} />
                <Row label="Phone" value={userData?.phone || "-"} />
              </div>
            </Section>

            <Divider />

            {/* Doctor Info */}
            <Section title="Doctor Information">
              <div className="flex items-center gap-4 bg-[#f5f6ff] rounded-xl p-4">
                <img
                  src={bill.docData?.image}
                  alt={bill.docData?.name}
                  className="w-16 h-16 rounded-full object-cover bg-[#EAEFFF]"
                />
                <div>
                  <p className="font-semibold text-[#262626]">{bill.docData?.name}</p>
                  <p className="text-sm text-gray-500">
                    {bill.docData?.degree} — {bill.docData?.speciality}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {bill.docData?.address?.line1}, {bill.docData?.address?.line2}
                  </p>
                </div>
              </div>
            </Section>

            <Divider />

            {/* Appointment Details */}
            <Section title="Appointment Details">
              <div className="bg-[#f5f6ff] rounded-xl p-4 space-y-2">
                <Row label="Date" value={formatDate(bill.slotDate)} />
                <Row label="Time" value={bill.slotTime || "-"} />
                <Row
                  label="Booked On"
                  value={bill.date ? new Date(bill.date).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                  }) : "-"}
                />
              </div>
            </Section>

            <Divider />

            {/* Amount */}
            <Section title="Amount Details">
              <div className="bg-[#f5f6ff] rounded-xl p-4 space-y-2">
                <Row
                  label="Consultation Fee"
                  value={`₹${bill.docData?.fees?.toFixed(2) || "0.00"}`}
                />
                <Row label="Discount" value="₹0.00" valueClass="text-green-600" />
                <hr className="border-gray-200 my-1" />
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#262626] text-lg">Total</span>
                  <span className="font-bold text-primary text-xl">
                    ₹{bill.docData?.fees?.toFixed(2) || "0.00"}
                  </span>
                </div>
              </div>
            </Section>

            <Divider />

            {/* Payment */}
            <Section title="Payment Information">
              <div className="bg-[#f5f6ff] rounded-xl p-4 space-y-2">
                <Row
                  label="Payment Method"
                  value={bill.payment ? "Razorpay" : "Not Paid"}
                />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className={`text-xs font-semibold px-4 py-1.5 rounded-full ${statusColor(status)}`}>
                    {status}
                  </span>
                </div>
              </div>

              {/* Pay Now — only if PENDING */}
              {isPending && (
                <button
                  onClick={payWithRazorpay}
                  className="w-full mt-3 bg-[#2563EB] text-white py-3 rounded-xl text-sm font-medium hover:scale-[1.02] transition-all duration-300"
                >
                  💳 Pay Rs. {bill.docData?.fees?.toFixed(2) || "0.00"} with Razorpay
                </button>
              )}
            </Section>

            {/* Refund Information — only if cancelled and paid */}
            {bill.cancelled && bill.payment && (
              <>
                <Divider />
                <Section title="Refund Information">
                  <div className="bg-[#f5f6ff] rounded-xl p-4 space-y-2">
                    <Row
                      label="Refund Status"
                      value={
                        bill.refundStatus === "full" ? "✅ Full Refund (100%)" :
                        bill.refundStatus === "partial_70" ? "🔄 70% Refund" :
                        bill.refundStatus === "partial_50" ? "🔄 50% Refund" :
                        bill.refundStatus === "no_refund" ? "❌ No Refund" : "-"
                      }
                    />
                    <Row
                      label="Refund Amount"
                      value={`₹${bill.refundAmount?.toFixed(2) || "0.00"}`}
                      valueClass="text-green-600 font-bold"
                    />
                    {bill.refundId && (
                      <Row label="Refund ID" value={bill.refundId} />
                    )}
                    {bill.refundStatus === "no_refund" && (
                      <p className="text-xs text-red-400 mt-1">
                        Cancelled within 6 hours — no refund applicable.
                      </p>
                    )}
                    {(bill.refundStatus === "full" || bill.refundStatus?.startsWith("partial")) && (
                      <p className="text-xs text-gray-400 mt-1">
                        Refund will reflect in your account within 5-7 business days.
                      </p>
                    )}
                  </div>
                </Section>
              </>
            )}

            <Divider />

            {/* Cancellation & Refund Policy — always show */}
            <Section title="Cancellation & Refund Policy">
              <div className="bg-[#f5f6ff] rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-green-500 text-base">✅</span>
                  <div>
                    <p className="font-medium text-[#262626]">Before 48 hours</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      100% full refund will be initiated immediately
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-blue-500 text-base">🔄</span>
                  <div>
                    <p className="font-medium text-[#262626]">Between 24–48 hours</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      70% refund — 30% cancellation fee applies
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-yellow-500 text-base">⚠️</span>
                  <div>
                    <p className="font-medium text-[#262626]">Between 12–24 hours</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      50% refund — 50% cancellation fee applies
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-red-500 text-base">❌</span>
                  <div>
                    <p className="font-medium text-[#262626]">Within 6 hours</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      No refund applicable
                    </p>
                  </div>
                </div>
                <hr className="border-gray-200" />
                <p className="text-xs text-gray-400">
                  Refunds are processed via Razorpay and reflect in your bank account within 5–7 business days after processing.
                </p>
              </div>
            </Section>

          </div>

          {/* Card Footer */}
          <div className="bg-[#f5f6ff] px-8 py-4 border-t border-gray-100">
            <p className="text-center text-xs text-gray-400">
              Thank you for choosing Appointy — Effortless Healthcare Scheduling
            </p>
          </div>
        </div>

        {/* Bottom Download */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={downloadPdf}
            className="flex items-center gap-2 bg-primary text-white text-sm px-10 py-3 rounded-full hover:scale-105 transition-all duration-300 shadow-lg shadow-primary/30"
          >
            ⬇ Download Bill as PDF
          </button>
        </div>
      </div>
    </div>
  );
};

// Helpers
const Section = ({ title, children }) => (
  <div>
    <h2 className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
      {title}
    </h2>
    {children}
  </div>
);

const Row = ({ label, value, valueClass = "" }) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-gray-500">{label}</span>
    <span className={`font-medium text-[#262626] ${valueClass}`}>{value}</span>
  </div>
);

const Divider = () => <hr className="border-gray-100" />;

export default BillDetailsPage;