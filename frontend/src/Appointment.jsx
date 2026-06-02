import React, { useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppContext } from './context/AppContext'
import { assets } from './assets/assets'
import RelatedDoctors from './components/RelatedDoctors'
import axios from 'axios'
import { toast } from 'react-toastify'

const Appointment = () => {
  const { docId } = useParams()
  const navigate = useNavigate()
  const { doctors, currencySymbol, backendUrl, token, getDoctorsData } = useContext(AppContext)
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const [docInfo, setDocInfo] = useState(null)
  const [docSlots, setDocSlots] = useState([])
  const [slotIndex, setSlotIndex] = useState(0)
  const [slotTime, setSlotTime] = useState('')

  // ✅ Lunch break: 1:30 PM to 2:30 PM
  const isLunchBreak = (time) => {
    const [timePart, modifier] = time.split(' ')
    let [hours, minutes] = timePart.split(':').map(Number)
    if (modifier === 'PM' && hours !== 12) hours += 12
    if (modifier === 'AM' && hours === 12) hours = 0
    const totalMinutes = hours * 60 + minutes
    // 1:30 PM = 810 mins, 2:30 PM = 870 mins
    return totalMinutes >= 810 && totalMinutes < 870
  }

  const fetchDocInfo = useCallback(async () => {
    const doc = doctors.find((doc) => doc._id === docId)
    if (doc) {
      setDocInfo({ ...doc, slots_booked: doc.slots_booked || {} })
    }
  }, [doctors, docId])

  const getAvailableSlots = useCallback(() => {
    if (!docInfo) return
    setDocSlots([])

    const today = new Date()

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(today)
      currentDate.setDate(today.getDate() + i)

      const endTime = new Date(currentDate)
      endTime.setHours(21, 0, 0, 0)

      if (today.getDate() === currentDate.getDate()) {
        currentDate.setHours(currentDate.getHours() > 10 ? currentDate.getHours() + 1 : 10)
        currentDate.setMinutes(currentDate.getMinutes() > 30 ? 30 : 0)
      } else {
        currentDate.setHours(10)
        currentDate.setMinutes(0)
      }

      const timeSlots = []

      while (currentDate < endTime) {
        const formattedTime = currentDate.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })

        const day = currentDate.getDate()
        const month = currentDate.getMonth() + 1
        const year = currentDate.getFullYear()
        const slotDate = `${day}_${month}_${year}`

        // ✅ Check if booked by another user
        const isBooked =
          docInfo?.slots_booked?.[slotDate] &&
          docInfo.slots_booked[slotDate].includes(formattedTime)

        // ✅ Check if lunch break
        const isLunch = isLunchBreak(formattedTime)

        timeSlots.push({
          datetime: new Date(currentDate),
          time: formattedTime,
          isBooked,   // ✅ booked by someone else
          isLunch,    // ✅ lunch break slot
        })

        currentDate.setMinutes(currentDate.getMinutes() + 30)
      }

      setDocSlots((prev) => [...prev, timeSlots])
    }
  }, [docInfo])

  const bookAppointment = async () => {
    if (!token) {
      toast.warning('Login to book appointment')
      return navigate('/login')
    }
    if (!slotTime) {
      return toast.warning('Please select a time slot')
    }

    const date = docSlots[slotIndex][0].datetime
    let day = date.getDate()
    let month = date.getMonth() + 1
    let year = date.getFullYear()
    const slotDate = day + "_" + month + "_" + year

    try {
      const { data } = await axios.post(
        backendUrl + '/api/user/book-appointment',
        { docId, slotDate, slotTime },
        { headers: { token } }
      )
      if (data.success) {
        toast.success(data.message)
        getDoctorsData()
        navigate('/my-appointments')
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  useEffect(() => {
    if (doctors.length > 0) {
      fetchDocInfo()
    }
  }, [doctors.length, fetchDocInfo])

  useEffect(() => {
    if (docInfo) {
      getAvailableSlots()
    }
  }, [docInfo, getAvailableSlots])

  return (
    docInfo && (
      <div>
        {/* Doctor details */}
        <div className='flex flex-col sm:flex-row gap-4'>
          <div>
            <img className='bg-primary w-full sm:max-w-72 rounded-lg' src={docInfo.image} alt="" />
          </div>
          <div className='flex-1 border border-[#ADADAD] rounded-lg p-8 py-7 bg-white mx-2 sm:mx-0 mt-[-80px] sm:mt-0'>
            <p className='flex items-center gap-2 text-3xl font-medium text-gray-700'>
              {docInfo.name} <img src={assets.verified_icon} alt="" />
            </p>
            <div className='flex items-center gap-2 mt-1 text-gray-600'>
              <p>{docInfo.degree} - {docInfo.speciality}</p>
              <button className='py-0.5 px-2 border text-xs rounded-full'>{docInfo.experience}</button>
            </div>
            <div>
              <p className='flex items-center gap-1 text-sm font-medium text-[#262626] mt-3'>
                About <img src={assets.info_icon} alt="" />
              </p>
              <p className='text-sm text-gray-600 max-w-[700px] mt-1'>{docInfo.about}</p>
            </div>
            <p className='text-gray-600 font-medium mt-4'>
              Appointment fee: <span className='text-gray-800'>{currencySymbol} {docInfo.fees}</span>
            </p>
          </div>
        </div>

        {/* Booking Slots */}
        <div className='sm:ml-72 sm:pl-4 mt-8 font-medium text-[#565656]'>
          <p>Booking slots</p>

          {/* Days Scroll */}
          <div className='flex gap-3 items-center w-full overflow-x-scroll mt-4'>
            {docSlots.length > 0 && docSlots.map((item, index) => (
              <div
                onClick={() => { setSlotIndex(index); setSlotTime('') }}
                key={index}
                className={`text-center py-6 min-w-16 rounded-full cursor-pointer ${
                  slotIndex === index
                    ? 'bg-primary text-white'
                    : 'border border-[#DDDDDD]'
                }`}
              >
                <p>{item[0] && daysOfWeek[item[0].datetime.getDay()]}</p>
                <p>{item[0] && item[0].datetime.getDate()}</p>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          <div className='flex flex-wrap items-center gap-3 w-full mt-4'>
            {docSlots.length > 0 && docSlots[slotIndex] &&
              docSlots[slotIndex].map((item, index) => {

                // ✅ Lunch break slot
                if (item.isLunch) {
                  return (
                    <div
                      key={index}
                      className='text-xs font-light flex-shrink-0 px-4 py-2 rounded-full bg-orange-100 text-orange-500 border border-orange-200 cursor-not-allowed flex items-center gap-1'
                      title='Lunch Break — Not Available'
                    >
                      🍽️ Lunch Break
                    </div>
                  )
                }

                // ✅ Booked slot — show in red disabled
                if (item.isBooked) {
                  return (
                    <div
                      key={index}
                      className='text-xs font-light flex-shrink-0 px-4 py-2 rounded-full bg-red-100 text-red-400 border border-red-200 cursor-not-allowed line-through'
                      title='Already Booked'
                    >
                      {item.time.toLowerCase()}
                    </div>
                  )
                }

                // ✅ Available slot
                return (
                  <p
                    onClick={() => setSlotTime(item.time)}
                    key={index}
                    className={`text-sm font-light flex-shrink-0 px-5 py-2 rounded-full cursor-pointer transition-all ${
                      item.time === slotTime
                        ? 'bg-primary text-white'
                        : 'text-[#949494] border border-[#B4B4B4] hover:border-primary hover:text-primary'
                    }`}
                  >
                    {item.time.toLowerCase()}
                  </p>
                )
              })
            }
          </div>

          {/* ✅ Slot Legend */}
          <div className='flex flex-wrap items-center gap-4 mt-4 text-xs text-gray-500'>
            <div className='flex items-center gap-1.5'>
              <div className='w-3 h-3 rounded-full bg-primary'></div>
              <span>Selected</span>
            </div>
            <div className='flex items-center gap-1.5'>
              <div className='w-3 h-3 rounded-full border border-[#B4B4B4]'></div>
              <span>Available</span>
            </div>
            <div className='flex items-center gap-1.5'>
              <div className='w-3 h-3 rounded-full bg-red-400'></div>
              <span>Booked</span>
            </div>
            <div className='flex items-center gap-1.5'>
              <div className='w-3 h-3 rounded-full bg-orange-400'></div>
              <span>Lunch Break (1:30 PM – 2:30 PM)</span>
            </div>
          </div>

          {/* Book Button */}
          <button
            onClick={bookAppointment}
            className='bg-primary text-white text-sm font-light px-20 py-3 rounded-full my-6'
          >
            Book an appointment
          </button>
        </div>

        {/* Related Doctors */}
        <RelatedDoctors speciality={docInfo.speciality} docId={docId} />
      </div>
    )
  )
}

export default Appointment