import AdminGuard from '@/components/AdminGuard';
import AdminNav from '@/components/AdminNav';

export default function AdminLayout({ children }) {
  return (
    <AdminGuard>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <AdminNav />
        {children}
      </div>
    </AdminGuard>
  );
}
