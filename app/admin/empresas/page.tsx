"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { API_ENDPOINTS } from '@/lib/constants';
import {
  Building2,
  Plus,
  ArrowLeft,
  Users,
  Trash2,
  Edit,
  X,
  Check,
  AlertTriangle,
} from "lucide-react";

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  active: boolean;
  createdAt: string;
  _count: {
    users: number;
  };
}

export default function AdminEmpresasPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    active: true,
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.COMPANIES);
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCompany(null);
    setFormData({ name: "", cnpj: "", active: true });
    setError("");
    setShowModal(true);
  };

  const openEditModal = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      cnpj: company.cnpj || "",
      active: company.active,
    });
    setError("");
    setShowModal(true);
  };

  const openDeleteModal = (company: Company) => {
    setDeletingCompany(company);
    setError("");
    setShowDeleteModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const url = editingCompany
        ? API_ENDPOINTS.COMPANY(editingCompany.id)
        : API_ENDPOINTS.COMPANIES;
      const method = editingCompany ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao salvar empresa");
        return;
      }

      setShowModal(false);
      fetchCompanies();
    } catch (error) {
      console.error("Error saving company:", error);
      setError("Erro ao salvar empresa");
    }
  };

  const handleDelete = async () => {
    if (!deletingCompany) return;
    setError("");

    try {
      const res = await fetch(API_ENDPOINTS.COMPANY(deletingCompany.id), {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao excluir empresa");
        return;
      }

      setShowDeleteModal(false);
      setDeletingCompany(null);
      fetchCompanies();
    } catch (error) {
      console.error("Error deleting company:", error);
      setError("Erro ao excluir empresa");
    }
  };

  const formatCNPJ = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, "");
    if (cleaned.length !== 14) return cnpj;
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-200 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Gestão de Empresas</h1>
              <p className="text-gray-500">Administre as federações cadastradas</p>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-[#08C97D] text-[#13161C] px-4 py-2 rounded-lg hover:bg-[#0AE18C] transition-all"
          >
            <Plus className="w-5 h-5" />
            Nova Empresa
          </button>
        </div>

        {/* Companies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company, index) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#DDF7EB] rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-[#08C97D]" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditModal(company)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#08C97D]"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openDeleteModal(company)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-gray-800 mb-1">{company.name}</h3>
              {company.cnpj && (
                <p className="text-sm text-gray-500 mb-4">CNPJ: {formatCNPJ(company.cnpj)}</p>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  <span>{company._count.users} usuários</span>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    company.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {company.active ? "Ativa" : "Inativa"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {companies.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhuma empresa cadastrada</p>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editingCompany ? "Editar Empresa" : "Nova Empresa"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Empresa *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#08C97D]"
                    placeholder="Federação Paulista de Futebol"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#08C97D]"
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                {editingCompany && (
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">Empresa ativa</span>
                    </label>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[#08C97D] text-[#13161C] rounded-lg hover:bg-[#0AE18C] flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {editingCompany ? "Salvar" : "Criar"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deletingCompany && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Excluir Empresa</h2>
                  <p className="text-gray-500 text-sm">Esta ação não pode ser desfeita</p>
                </div>
              </div>

              <p className="text-gray-600 mb-6">
                Tem certeza que deseja excluir a empresa{" "}
                <strong>{deletingCompany.name}</strong>?
              </p>

              {deletingCompany._count.users > 0 && (
                <div className="bg-amber-50 text-amber-700 px-4 py-3 rounded-lg text-sm mb-4">
                  Esta empresa possui {deletingCompany._count.users} usuário(s) vinculado(s).
                  Remova os vínculos antes de excluir.
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingCompany(null);
                    setError("");
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
