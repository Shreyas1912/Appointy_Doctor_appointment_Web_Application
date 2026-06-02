import mongoose from "mongoose"

const appointmentSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    docId: { type: String, required: true },
    slotDate: { type: String, required: true },
    slotTime: { type: String, required: true },
    userData: { type: Object, required: true },
    docData: { type: Object, required: true },
    amount: { type: Number, required: true },
    date: { type: Number, required: true },
    cancelled: { type: Boolean, default: false },
    payment: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false },
    
    refundStatus: { 
        type: String, 
        enum: ['none', 'full', 'partial_70', 'partial_50', 'no_refund'],
        default: 'none' 
    },
    refundAmount: { type: Number, default: 0 },
    refundId: { type: String, default: '' },
     razorpayOrderId: { type: String, default: '' },
})

const appointmentModel = mongoose.models.appointment || mongoose.model("appointment", appointmentSchema)
export default appointmentModel