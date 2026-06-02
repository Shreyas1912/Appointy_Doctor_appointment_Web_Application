import React, { useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { assets } from '../assets/assets'

const MyAppointments = () => {
  const { backendUrl, token, getDoctorsData } = useContext(AppContext)
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [payment, setPayment] = useState('')
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [pendingPaymentId, setPendingPaymentId] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelInfo, setCancelInfo] = useState({ id: '', msg: '', percent: 0, color: '' })

  const months = [' ', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const slotDateFormat = (slotDate) => {
    const [day, month, year] = slotDate.split('_')
    return `${day} ${months[Number(month)]} ${year}`
  }

  // Get user appointments
  const getUserAppointments = useCallback(async () => {
    try {
      const { data } = await axios.post(
        backendUrl + '/api/user/appointments',
        {},
        { headers: { token } }
      )
      setAppointments(data.appointments.reverse())
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }, [backendUrl, token])

  // Cancel appointment
  const cancelAppointment = async (appointmentId) => {
    try {
      const { data } = await axios.post(
        backendUrl + '/api/user/cancel-appointment',
        { appointmentId },
        { headers: { token } }
      )
      if (data.success) {
        toast.success(data.message)
        getUserAppointments()
        getDoctorsData()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  // Razorpay init
  const initPay = (order) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: 'Appointment Payment',
      description: 'Appointment Payment',
      order_id: order.id,
      receipt: order.receipt,
      handler: async (response) => {
        try {
          const { data } = await axios.post(
            backendUrl + '/api/user/verifyRazorpay',
            response,
            { headers: { token } }
          )
          if (data.success) {
            navigate('/my-appointments')
            getUserAppointments()
          }
        } catch (error) {
          console.log(error)
          toast.error(error.message)
        }
      }
    }
    const rzp = new window.Razorpay(options)
    rzp.open()
  }

  // Razorpay payment
  const appointmentRazorpay = async (appointmentId) => {
    try {
      const { data } = await axios.post(
        backendUrl + '/api/user/payment-razorpay',
        { appointmentId },
        { headers: { token } }
      )
      if (data.success) {
        initPay(data.order)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  // ✅ Handle Pay Online click — show policy modal first
  const handlePayOnlineClick = (appointmentId) => {
    setPendingPaymentId(appointmentId)
    setShowPolicyModal(true)
  }

  // ✅ User agrees to policy — proceed to Razorpay
  const handleAgreeAndPay = () => {
    setShowPolicyModal(false)
    setPayment(pendingPaymentId)
  }

  // ✅ Handle Cancel click — show custom cancel modal
  const handleCancelClick = (item) => {
    const apptDate = item.slotDate.split('_')
    const apptTime = new Date(
      `${apptDate[2]}-${String(apptDate[1]).padStart(2, '0')}-${String(apptDate[0]).padStart(2, '0')} ${item.slotTime}`
    )
    const hoursLeft = (apptTime - new Date()) / (1000 * 60 * 60)

    let msg = ''
    let percent = 0
    let color = 'gray'
    let icon = '🗓️'

    if (!item.payment) {
      msg = 'Are you sure you want to cancel this appointment?'
      color = 'red'
      icon = '🗓️'
      percent = -1 // no payment so no refund info
    } else if (hoursLeft > 48) {
      msg = 'You will receive a 100% full refund since you are cancelling more than 48 hours before your appointment.'
      percent = 100
      color = 'green'
      icon = '✅'
    } else if (hoursLeft > 24) {
      msg = 'You will receive a 70% refund. A 30% cancellation fee applies as you are cancelling within 24–48 hours.'
      percent = 70
      color = 'blue'
      icon = '🔄'
    } else if (hoursLeft > 12) {
      msg = 'You will receive a 50% refund. A 50% cancellation fee applies as you are cancelling within 12–24 hours.'
      percent = 50
      color = 'yellow'
      icon = '⚠️'
    } else {
      msg = 'No refund will be issued as you are cancelling within 6 hours of your appointment.'
      percent = 0
      color = 'red'
      icon = '❌'
    }

    setCancelInfo({ id: item._id, msg, percent, color, icon })
    setShowCancelModal(true)
  }

  useEffect(() => {
    if (token) {
      getUserAppointments()
    }
  }, [token, getUserAppointments])

  // ✅ Color classes for cancel modal
  const colorMap = {
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  btn: 'bg-green-500 hover:bg-green-600' },
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   btn: 'bg-blue-500 hover:bg-blue-600' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', btn: 'bg-yellow-500 hover:bg-yellow-600' },
    red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    btn: 'bg-red-500 hover:bg-red-600' },
    gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-700',   btn: 'bg-gray-500 hover:bg-gray-600' },
  }

  const c = colorMap[cancelInfo.color] || colorMap.gray

  return (
    <div>

      {/* ✅ Pay Online — Policy Modal */}
      {showPolicyModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4'>
          <div className='bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in'>

            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-lg font-semibold text-[#262626]'>📋 Cancellation & Refund Policy</h2>
              <button
                onClick={() => setShowPolicyModal(false)}
                className='text-gray-400 hover:text-gray-600 text-xl font-bold leading-none'
              >✕</button>
            </div>

            <p className='text-sm text-gray-500 mb-4'>
              Please read our cancellation policy carefully before proceeding with payment.
            </p>

            <div className='space-y-2 mb-5'>
              <div className='flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl p-3'>
                <span className='text-lg'>✅</span>
                <div>
                  <p className='text-sm font-semibold text-[#262626]'>Before 48 hours</p>
                  <p className='text-xs text-gray-500 mt-0.5'>100% full refund will be initiated immediately</p>
                </div>
              </div>
              <div className='flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3'>
                <span className='text-lg'>🔄</span>
                <div>
                  <p className='text-sm font-semibold text-[#262626]'>Between 24–48 hours</p>
                  <p className='text-xs text-gray-500 mt-0.5'>70% refund — 30% cancellation fee applies</p>
                </div>
              </div>
              <div className='flex items-start gap-3 bg-yellow-50 border border-yellow-100 rounded-xl p-3'>
                <span className='text-lg'>⚠️</span>
                <div>
                  <p className='text-sm font-semibold text-[#262626]'>Between 12–24 hours</p>
                  <p className='text-xs text-gray-500 mt-0.5'>50% refund — 50% cancellation fee applies</p>
                </div>
              </div>
              <div className='flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-3'>
                <span className='text-lg'>❌</span>
                <div>
                  <p className='text-sm font-semibold text-[#262626]'>Within 6 hours</p>
                  <p className='text-xs text-gray-500 mt-0.5'>No refund applicable</p>
                </div>
              </div>
            </div>

            <p className='text-xs text-gray-400 mb-5 text-center'>
              Refunds are processed via Razorpay and reflect in your bank account within 5–7 business days.
            </p>

            <div className='flex gap-3'>
              <button
                onClick={() => setShowPolicyModal(false)}
                className='flex-1 py-2.5 border border-gray-300 rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-all bg-gray-200'
              >
                Cancel
              </button>
              <button
                onClick={handleAgreeAndPay}
                className='flex-1 py-2.5 bg-primary text-white rounded-full text-sm font-semibold hover:scale-105 transition-all'
              >
                ✅ I Agree & Pay
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ✅ Cancel Appointment — Custom Modal */}
      {showCancelModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4'>
          <div className={`bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border-2 ${c.border}`}>

            {/* Icon + Title */}
            <div className='text-center mb-4'>
              <div className='text-5xl mb-3'>{cancelInfo.icon}</div>
              <h2 className='text-lg font-bold text-[#262626]'>Cancel Appointment?</h2>
            </div>

            {/* Refund Info Box */}
            <div className={`${c.bg} ${c.border} border rounded-xl p-4 mb-4`}>
              <p className={`text-sm font-medium ${c.text} text-center`}>
                {cancelInfo.msg}
              </p>
              {cancelInfo.percent >= 0 && cancelInfo.percent !== -1 && (
                <div className='mt-3 flex justify-center'>
                  <span className={`text-2xl font-bold ${c.text}`}>
                    {cancelInfo.percent}% Refund
                  </span>
                </div>
              )}
            </div>

            <p className='text-xs text-gray-400 text-center mb-5'>
              This action cannot be undone. The appointment slot will be released.
            </p>

            {/* Buttons */}
            <div className='flex gap-3'>
              <button
                onClick={() => setShowCancelModal(false)}
                className='flex-1 py-2.5 border border-gray-300 rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-all'
              >
                Keep Appointment
              </button>
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  cancelAppointment(cancelInfo.id)
                }}
                className={`flex-1 py-2.5 text-white rounded-full text-sm font-semibold transition-all hover:scale-105 ${c.btn}`}
              >
                Yes, Cancel
              </button>
            </div>

          </div>
        </div>
      )}

      <p className='pb-3 mt-12 text-lg font-medium text-gray-600 border-b'>My appointments</p>
      <div>
        {appointments.length === 0 && (
          <p className='text-gray-500 text-center mt-10 py-10'>
            You have no appointments yet.
          </p>
        )}
        {appointments.map((item, index) => (
          <div key={index} className='grid grid-cols-[1fr_2fr] gap-4 sm:flex sm:gap-6 py-4 border-b'>

            {/* Doctor Image */}
            <div>
              <img className='w-36 bg-[#EAEFFF]' src={item.docData.image} alt='' />
            </div>

            {/* Doctor Info */}
            <div className='flex-1 text-sm text-[#5E5E5E]'>
              <p className='text-[#262626] text-base font-semibold'>{item.docData.name}</p>
              <p>{item.docData.speciality}</p>
              <p className='text-[#464646] font-medium mt-1'>Address:</p>
              <p>{item.docData.address.line1}</p>
              <p>{item.docData.address.line2}</p>
              <p className='mt-1'>
                <span className='text-sm text-[#3C3C3C] font-medium'>Date & Time:</span>{' '}
                {slotDateFormat(item.slotDate)} | {item.slotTime}
              </p>
            </div>

            <div></div>

            {/* Action Buttons */}
            <div className='flex flex-col gap-2 justify-end text-sm text-center'>

              {/* View Bill — always show for non cancelled */}
              {!item.cancelled && (
                <button
                  onClick={() => navigate(`/bill/${item._id}`)}
                  className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-primary hover:text-white transition-all duration-300'
                >
                  🧾 View Bill
                </button>
              )}

              {/* View Bill — show for cancelled but paid */}
              {item.cancelled && item.payment && (
                <button
                  onClick={() => navigate(`/bill/${item._id}`)}
                  className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-primary hover:text-white transition-all duration-300'
                >
                  🧾 View Bill
                </button>
              )}

              {/* Pay Online — opens policy modal */}
              {!item.cancelled && !item.payment && !item.isCompleted && payment !== item._id && (
                <button
                  onClick={() => handlePayOnlineClick(item._id)}
                  className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-primary hover:text-white transition-all duration-300'
                >
                  Pay Online
                </button>
              )}

              {/* Razorpay Logo Button */}
              {!item.cancelled && !item.payment && !item.isCompleted && payment === item._id && (
                <button
                  onClick={() => appointmentRazorpay(item._id)}
                  className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-gray-100 transition-all duration-300 flex items-center justify-center'
                >
                  <img className='max-w-20 max-h-5' src={assets.razorpay_logo} alt='Razorpay' />
                </button>
              )}

              {/* Paid */}
              {!item.cancelled && item.payment && !item.isCompleted && (
                <button className='sm:min-w-48 py-2 border rounded text-[#696969] bg-[#EAEFFF]'>
                  Paid
                </button>
              )}

              {/* Completed */}
              {item.isCompleted && (
                <button className='sm:min-w-48 py-2 border border-green-500 rounded text-green-500'>
                  Completed
                </button>
              )}

              {/* Cancel button — opens custom modal */}
              {!item.cancelled && !item.isCompleted && (
                <button
                  onClick={() => handleCancelClick(item)}
                  className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-red-600 hover:text-white transition-all duration-300'
                >
                  Cancel appointment
                </button>
              )}

              {/* Cancelled — show refund info */}
              {item.cancelled && !item.isCompleted && (
                <div className='flex flex-col gap-1'>
                  <button className='sm:min-w-48 py-2 border border-red-500 rounded text-red-500'>
                    Appointment cancelled
                  </button>
                  {item.payment && (
                    <p className='text-xs text-center text-gray-500'>
                      {item.refundStatus === 'full' && `✅ Full refund of ₹${item.refundAmount} initiated`}
                      {item.refundStatus === 'partial_70' && `🔄 70% refund of ₹${item.refundAmount} initiated`}
                      {item.refundStatus === 'partial_50' && `🔄 50% refund of ₹${item.refundAmount} initiated`}
                      {item.refundStatus === 'no_refund' && `❌ No refund (cancelled within 6hrs)`}
                      {item.refundStatus === 'none' && `💵 Cash appointment - no refund needed`}
                    </p>
                  )}
                </div>
              )}

            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MyAppointments