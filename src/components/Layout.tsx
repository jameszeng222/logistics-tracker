import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import { useLogisticsStore } from '@/store/logisticsStore'
import { useEffect } from 'react'

export default function Layout() {
  const initialize = useLogisticsStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <main className="ml-[220px] min-h-screen">
        <div className="p-8 max-w-[1440px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
