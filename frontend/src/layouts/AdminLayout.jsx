import SidebarNav from '../components/SidebarNav';

export default function AdminLayout({ children }) {
  return (
    <div className="app-layout-sidebar">
      <SidebarNav />
      <div className="sidebar-main-content">
        <main className="sidebar-main-inner" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
