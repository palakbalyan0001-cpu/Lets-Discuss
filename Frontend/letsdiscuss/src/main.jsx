import { createRoot } from 'react-dom/client'
import { Provider } from "react-redux"
import { BrowserRouter } from "react-router-dom"
import App from './App.jsx'
import { store } from "./store"
import { fetchMe } from "./store/authSlice"
import "./styles/index.css"

// find out if there is a valid login cookie before the first screen is drawn
store.dispatch(fetchMe())

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Provider>
)
