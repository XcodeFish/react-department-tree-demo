import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Ant Design 5.x不再需要显式引入CSS文件
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
