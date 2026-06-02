import validator from 'validator'
import bcrypt from 'bcrypt'
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import jwt from "jsonwebtoken";
import {v2 as cloudinary} from 'cloudinary'  
import razorpay from 'razorpay';

// API to register user
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.json({ success: false, message: 'Missing Details' })
        }

        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" })
        }

        if (password.length < 8) {
            return res.json({ success: false, message: "Please enter a strong password" })
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt)

        const userData = {
            name,
            email,
            password: hashedPassword,
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

        res.json({ success: true, token })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to login user
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email })

        if (!user) {
            return res.json({ success: false, message: "User does not exist" })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
            res.json({ success: true, token })
        } else {
            res.json({ success: false, message: "Invalid credentials" })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user profile data
const getProfile = async (req, res) => {
    try {
        const { userId } = req.body
        const userData = await userModel.findById(userId).select('-password')
        res.json({ success: true, userData })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to update user profile
const updateProfile = async (req, res) => {
    try {
        const { userId, name, phone, address, dob, gender } = req.body
        const imageFile = req.file

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: "Data Missing" })
        }

        await userModel.findByIdAndUpdate(userId, { 
            name, 
            phone, 
            address: JSON.parse(address), 
            dob, 
            gender 
        })

        if (imageFile) {
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { 
                resource_type: "image" 
            })
            const imageURL = imageUpload.secure_url
            await userModel.findByIdAndUpdate(userId, { image: imageURL })
        }

        res.json({ success: true, message: 'Profile Updated' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to book appointment
const bookAppointment = async (req, res) => {
    try {
        const { userId, docId, slotDate, slotTime } = req.body
        const docData = await doctorModel.findById(docId).select("-password")

        if (!docData.available) {
            return res.json({ success: false, message: 'Doctor Not Available' })
        }

        let slots_booked = docData.slots_booked

        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return res.json({ success: false, message: 'Slot Not Available' })
            } else {
                slots_booked[slotDate].push(slotTime)
            }
        } else {
            slots_booked[slotDate] = []
            slots_booked[slotDate].push(slotTime)
        }

        const userData = await userModel.findById(userId).select("-password")
        delete docData.slots_booked

        const appointmentData = {
            userId,
            docId,
            userData,
            docData,
            amount: docData.fees,
            slotTime,
            slotDate,
            date: Date.now()
        }

        const newAppointment = new appointmentModel(appointmentData)
        await newAppointment.save()

        await doctorModel.findByIdAndUpdate(docId, { slots_booked })

        res.json({ success: true, message: 'Appointment Booked' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// ── Refund helper ─────────────────────────────────────────────────────
const calculateRefund = (appointmentDateTime, amount) => {
    const now = new Date()
    const apptTime = new Date(appointmentDateTime)
    const hoursLeft = (apptTime - now) / (1000 * 60 * 60)

    console.log(`Hours left until appointment: ${hoursLeft}`) // ✅ helpful debug log

    if (hoursLeft > 48) {
        // More than 48hrs — 100% refund
        return { percent: 100, refundAmount: amount, refundStatus: 'full' }
    } else if (hoursLeft > 24) {
        // Between 24–48hrs — 70% refund
        return { percent: 70, refundAmount: Math.round(amount * 0.7), refundStatus: 'partial_70' }
    } else if (hoursLeft > 12) {
        // Between 12–24hrs — 50% refund
        return { percent: 50, refundAmount: Math.round(amount * 0.5), refundStatus: 'partial_50' }
    } else if (hoursLeft > 6) {
        // Between 6–12hrs — 0% refund (no refund but not within 6hrs)
        return { percent: 0, refundAmount: 0, refundStatus: 'no_refund' }
    } else {
        // Less than 6hrs — 0% refund
        return { percent: 0, refundAmount: 0, refundStatus: 'no_refund' }
    }
}

// ── Parse appointment datetime from slotDate + slotTime ──────────────
const parseAppointmentDateTime = (slotDate, slotTime) => {
    // slotDate format: "15_3_2026"
    const [day, month, year] = slotDate.split('_')

    // slotTime format: "10:00 AM" or "02:30 PM"
    const [time, modifier] = slotTime.split(' ')
    let [hours, minutes] = time.split(':').map(Number)

    if (modifier === 'PM' && hours !== 12) hours += 12
    if (modifier === 'AM' && hours === 12) hours = 0

    const apptDate = new Date(
        Number(year),
        Number(month) - 1,  // month is 0-indexed in JS
        Number(day),
        hours,
        minutes,
        0
    )

    console.log(`Appointment DateTime: ${apptDate}`) // ✅ debug log
    console.log(`Current DateTime: ${new Date()}`)   // ✅ debug log

    return apptDate
}

// API to cancel appointment with refund
const cancelAppointment = async (req, res) => {
    try {
        const { userId, appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData) {
            return res.json({ success: false, message: 'Appointment not found' })
        }

        if (appointmentData.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment already cancelled' })
        }

        // ── Mark as cancelled ─────────────────────────────────────────
        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })

        // ── Release doctor slot ───────────────────────────────────────
        const { docId, slotDate, slotTime } = appointmentData
        const doctorData = await doctorModel.findById(docId)
        let slots_booked = doctorData.slots_booked
        if (slots_booked[slotDate]) {
            slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)
        }
        await doctorModel.findByIdAndUpdate(docId, { slots_booked })

        // ── Refund logic (only if paid online) ───────────────────────
        if (appointmentData.payment) {
            const apptDateTime = parseAppointmentDateTime(slotDate, slotTime)
            const { percent, refundAmount, refundStatus } = calculateRefund(apptDateTime, appointmentData.amount)

            if (percent > 0) {
                try {
                    // ✅ Use saved razorpayOrderId instead of appointmentId
                    const razorpayOrderId = appointmentData.razorpayOrderId

                    if (!razorpayOrderId) {
                        // Order ID not saved — mark for manual refund
                        await appointmentModel.findByIdAndUpdate(appointmentId, {
                            refundStatus,
                            refundAmount,
                        })
                        return res.json({
                            success: true,
                            message: `Appointment Cancelled. Refund of ₹${refundAmount} will be processed manually.`,
                            refundAmount,
                            refundStatus
                        })
                    }

                    // ✅ Fetch payments using correct Razorpay order ID
                    const payments = await razorpayInstance.orders.fetchPayments(razorpayOrderId)
                    const paymentId = payments.items[0]?.id

                    if (paymentId) {
                        const refund = await razorpayInstance.payments.refund(paymentId, {
                            amount: refundAmount * 100, // in paise
                            notes: {
                                appointmentId: appointmentId,
                                reason: 'Appointment Cancelled'
                            }
                        })

                        await appointmentModel.findByIdAndUpdate(appointmentId, {
                            refundStatus,
                            refundAmount,
                            refundId: refund.id
                        })

                        return res.json({
                            success: true,
                            message: `Appointment Cancelled. Refund of ₹${refundAmount} (${percent}%) initiated successfully.`,
                            refundAmount,
                            refundStatus,
                            refundId: refund.id
                        })
                    } else {
                        await appointmentModel.findByIdAndUpdate(appointmentId, {
                            refundStatus,
                            refundAmount,
                        })
                        return res.json({
                            success: true,
                            message: `Appointment Cancelled. Refund of ₹${refundAmount} will be processed manually.`,
                            refundAmount,
                            refundStatus
                        })
                    }

                } catch (refundError) {
                    console.error('Razorpay refund error:', refundError)
                    await appointmentModel.findByIdAndUpdate(appointmentId, {
                        refundStatus,
                        refundAmount,
                    })
                    return res.json({
                        success: true,
                        message: `Appointment Cancelled. Refund of ₹${refundAmount} will be processed within 5-7 business days.`,
                        refundAmount,
                        refundStatus
                    })
                }

            } else {
                // 0% refund — doctor keeps the earning
                await appointmentModel.findByIdAndUpdate(appointmentId, {
                    refundStatus: 'no_refund',
                    refundAmount: 0
                })
                return res.json({
                    success: true,
                    message: 'Appointment Cancelled. No refund applicable as cancellation was within 6 hours of appointment.',
                    refundAmount: 0,
                    refundStatus: 'no_refund'
                })
            }

        } else {
            // Not paid online — just cancel, no refund needed
            await appointmentModel.findByIdAndUpdate(appointmentId, {
                refundStatus: 'none',
                refundAmount: 0
            })
            return res.json({ success: true, message: 'Appointment Cancelled' })
        }

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user appointments
const listAppointment = async (req, res) => {
    try {
        const { userId } = req.body
        const appointments = await appointmentModel.find({ userId })
        res.json({ success: true, appointments })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// ── Razorpay Instance ─────────────────────────────────────────────────
const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
})

// API to make payment of appointment using razorpay
const paymentRazorpay = async (req, res) => {
    try {
        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled or not found' })
        }

        const options = {
            amount: appointmentData.amount * 100,
            currency: process.env.CURRENCY,
            receipt: appointmentId,
        }

        const order = await razorpayInstance.orders.create(options)
        res.json({ success: true, order })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to verify payment of razorpay
const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id } = req.body
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)

        if (orderInfo.status === 'paid') {
            // ✅ Save razorpayOrderId when marking as paid
            await appointmentModel.findByIdAndUpdate(orderInfo.receipt, { 
                payment: true,
                razorpayOrderId: razorpay_order_id  // ✅ save for refund later
            })
            res.json({ success: true, message: "Payment Successful" })
        } else {
            res.json({ success: false, message: 'Payment Failed' })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    bookAppointment,
    listAppointment,
    cancelAppointment,
    paymentRazorpay,
    verifyRazorpay
}