import HeaderNav from '../components/HeaderNav';

export default function StudentLayout({ children }) {
  return (
    <div className="app-layout-topbar">
      <HeaderNav />
      <main className="main-content-topbar" id="main-content">
        {children}
      </main>
    </div>
  );
}
