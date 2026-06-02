import React from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { FaFacebookF, FaInstagram, FaTwitter, FaLinkedinIn } from 'react-icons/fa'

const Footer = () => {

  const navigate = useNavigate()
  const year = new Date().getFullYear()

  return (
    <div className='px-6 md:px-10'>
      <div className='grid md:grid-cols-[3fr_1fr_1fr] gap-12 my-10 mt-24 text-sm items-start'>

        {/* Left Section */}
        <div className='flex items-start gap-4'>
          <div>
            <img className='w-28 mt-1' src={assets.logo} alt='Appointy Logo' />

            <p className='text-gray-600 leading-6 md:max-w-[75%] mt-3'>
              <strong>Appointy – Effortless Healthcare Scheduling</strong> <br />
              Patients can instantly book appointments with trusted doctors—from routine check-ups to specialist care—in just a few clicks.
            </p>

            {/* Social Icons */}
            <div className='flex gap-4 mt-4'>
              <a
                href='https://facebook.com'
                target='_blank'
                rel='noreferrer'
                className='w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300'
              >
                <FaFacebookF size={14} />
              </a>

              <a
                href='https://instagram.com'
                target='_blank'
                rel='noreferrer'
                className='w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300'
              >
                <FaInstagram size={14} />
              </a>

              <a
                href='https://twitter.com'
                target='_blank'
                rel='noreferrer'
                className='w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300'
              >
                <FaTwitter size={14} />
              </a>

              <a
                href='https://linkedin.com'
                target='_blank'
                rel='noreferrer'
                className='w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300'
              >
                <FaLinkedinIn size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* Middle Section */}
        <div>
          <p className='text-lg font-semibold mb-4'>COMPANY</p>
          <ul className='flex flex-col gap-2 text-gray-600'>
            <li onClick={() => navigate('/')} className='cursor-pointer hover:text-primary transition'>Home</li>
            <li onClick={() => navigate('/about')} className='cursor-pointer hover:text-primary transition'>About Us</li>
            <li onClick={() => navigate('/contact')} className='cursor-pointer hover:text-primary transition'>Contact Us</li>
            <li onClick={() => navigate('/privacy')} className='cursor-pointer hover:text-primary transition'>Privacy Policy</li>
          </ul>
        </div>

        {/* Right Section */}
        <div>
          <p className='text-lg font-semibold mb-4'>GET IN TOUCH</p>
          <ul className='flex flex-col gap-2 text-gray-600'>
            <li>
              <a href='tel:+919000090000' className='hover:text-primary transition'>
                +91-90000-90000
              </a>
            </li>
            <li>
              <a href='mailto:customersupport@appointy.in' className='hover:text-primary transition'>
                customersupport@appointy.in
              </a>
            </li>
          </ul>
        </div>

      </div>

      <hr className='border-gray-300' />
      <p className='py-4 text-sm text-center text-gray-600'>
        © {year} appointy.in — All Rights Reserved.
      </p>
    </div>
  )
}

export default Footer