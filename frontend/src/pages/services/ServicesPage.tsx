import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import ClientTab from './ClientTab'
import ServiceCatalogTab from './ServiceCatalogTab'
import PrestationTab from './PrestationTab'
import RecouvrementPrestationTab from './RecouvrementPrestationTab'

export default function ServicesPage() {
  return (
    <div className="app-layout">
      <Sidebar section="services" />
      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title">Services</span>
        </div>
        <div style={{ padding: 24 }}>
          <Routes>
            <Route path="clients"      element={<ClientTab />} />
            <Route path="catalogue"    element={<ServiceCatalogTab />} />
            <Route path="prestation"   element={<PrestationTab />} />
            <Route path="recouvrement" element={<RecouvrementPrestationTab />} />
            <Route path="*" element={<Navigate to="/services/clients" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}