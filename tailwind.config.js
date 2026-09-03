/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        church: {
          50: '#fbf7ee',
          100: '#f5edd6',
          200: '#ebd9ad',
          300: '#dec07e',
          400: '#d0a753',
          500: '#b88936',
          600: '#9b6c2a',
          700: '#7a5124',
          800: '#654223',
          900: '#553720',
          950: '#301c10',
        },
        royal: {
          50: '#eef6ff',
          100: '#d9ecff',
          200: '#bcdbff',
          300: '#8ec2ff',
          400: '#599dff',
          500: '#3377fc',
          600: '#1d57f0',
          700: '#1542dd',
          800: '#1736b3',
          900: '#19328d',
          950: '#142056',
        }
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.03)' },
        }
      },
      animation: {
        float: 'float 3s ease-in-out infinite',
        pulseGlow: 'pulseGlow 2s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
