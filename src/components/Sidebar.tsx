import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  MapPin,
  BarChart3,
  AlertTriangle,
  Shield,
  Ship,
  Key,
  Database,
  Truck,
  ShieldCheck,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { path: '/', label: '数据总览', icon: LayoutDashboard },
  { path: '/tracking', label: '订单追踪', icon: MapPin },
  { path: '/delivery', label: '时效看板', icon: BarChart3 },
  { path: '/exceptions', label: '异常处理', icon: AlertTriangle },
  { path: '/monitoring', label: '履约监控', icon: Shield },
]

const settingsItems = [
  { path: '/settings/api', label: 'API 管理', icon: Key },
  { path: '/settings/data-source', label: '数据源管理', icon: Database },
  { path: '/settings/carriers', label: '运输商管理', icon: Truck },
  { path: '/settings/sla', label: 'SLA 配置', icon: ShieldCheck },
  { path: '/settings/other', label: '其他管理', icon: MoreHorizontal },
]

export default function Sidebar() {
  const location = useLocation()
  const [settingsOpen, setSettingsOpen] = useState(
    location.pathname.startsWith('/settings')
  )

  const isSettingsActive = location.pathname.startsWith('/settings')

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-white border-r border-slate-200 flex flex-col z-50">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-100">
        <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
          <Ship className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-slate-800 leading-tight">跨境物流追踪</h1>
          <p className="text-[10px] text-slate-400 leading-tight">Logistics Tracker</p>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path
          return (
            <NavLink
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
              <span>{label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </NavLink>
          )
        })}

        <div className="pt-3">
          <button
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 w-full ${
              isSettingsActive
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <Ship className={`w-[18px] h-[18px] flex-shrink-0 ${isSettingsActive ? 'text-blue-500' : 'text-slate-400'}`} />
            <span>系统设置</span>
            {settingsOpen ? (
              <ChevronDown className="w-3.5 h-3.5 ml-auto text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
            )}
          </button>

          {settingsOpen && (
            <div className="mt-1 ml-3 pl-3 border-l border-slate-200 space-y-0.5">
              {settingsItems.map(({ path, label, icon: Icon }) => {
                const isActive = location.pathname === path
                return (
                  <NavLink
                    key={path}
                    to={path}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                    }`}
                  >
                    <Icon className={`w-[14px] h-[14px] flex-shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-300'}`} />
                    <span>{label}</span>
                  </NavLink>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500">
            A
          </div>
          <div>
            <p className="text-xs font-medium text-slate-700">管理员</p>
            <p className="text-[10px] text-slate-400">admin@logistics.com</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
