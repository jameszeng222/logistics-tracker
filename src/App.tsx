import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Tracking from '@/pages/Tracking'
import DeliveryDashboard from '@/pages/DeliveryDashboard'
import Exceptions from '@/pages/Exceptions'
import FulfillmentMonitor from '@/pages/FulfillmentMonitor'
import ApiSettings from '@/pages/settings/ApiSettings'
import DataSourceSettings from '@/pages/settings/DataSourceSettings'
import CarrierSettings from '@/pages/settings/CarrierSettings'
import SlaSettings from '@/pages/settings/SlaSettings'
import OtherSettings from '@/pages/settings/OtherSettings'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="/delivery" element={<DeliveryDashboard />} />
          <Route path="/exceptions" element={<Exceptions />} />
          <Route path="/monitoring" element={<FulfillmentMonitor />} />
          <Route path="/settings/api" element={<ApiSettings />} />
          <Route path="/settings/data-source" element={<DataSourceSettings />} />
          <Route path="/settings/carriers" element={<CarrierSettings />} />
          <Route path="/settings/sla" element={<SlaSettings />} />
          <Route path="/settings/other" element={<OtherSettings />} />
        </Route>
      </Routes>
    </Router>
  )
}
