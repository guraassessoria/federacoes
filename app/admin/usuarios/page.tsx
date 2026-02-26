"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  ArrowLeft,
  Mail,
  Shield,
  Building2,
  Trash2,
  Edit,
  X,
  Check,
  AlertTriangle,
} from "lucide-react";

interface UserCompany {
  id: string;
  role: string;
  company: {
    id: string;
    name: string;
  };
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  companies: UserCompany[];
}

interface Company {
  id: string;
  name: string;
}

export default function AdminUsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "CONSULTA",
    companyIds: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, companiesRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/companies"),
      ]);
      const usersData = await usersRes.json();
      const companiesData = await companiesRes.json();
      setUsers(usersData.users || []);
      setCompanies(companiesData.companies || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: "",
      password: "",
      name: "",
      role: "CONSULTA",
      companyIds: [],
    });
    setError("");
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: "",
      name: user.name || "",
      role: user.role,
      companyIds: user.companies.map((uc) => uc.company.id),
    });
    setError("");
    setShowModal(true);
  };

  const openDeleteModal = (user: User) => {
    setDeletingUser(user);
    setError("");
    setShowDeleteModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      // Para edição, só enviar senha se foi preenchida
      const payload = editingUser
        ? {
            ...formData,
            password: formData.password || undefined,
          }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao salvar usuário");
        return;
      }

      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error("Error saving user:", error);
      setError("Erro ao salvar usuário");
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setError("");

    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao excluir usuário");
        return;
      }

      setShowDeleteModal(false);
      setDeletingUser(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting user:", error);
      setError("Erro ao excluir usuário");
    }
  };

  const toggleCompany = (companyId: string) => {
    setFormData((prev) => ({
      ...prev,
      companyIds: prev.companyIds.includes(companyId)
        ? prev.companyIds.filter((id) => id !== companyId)
        : [...prev.companyIds, companyId],
    }));
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-100 text-red-700";
      case "EDITOR":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
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
              <h1 className="text-2xl font-bold text-gray-800">Gestão de Usuários</h1>
              <p className="text-gray-500">Administre os usuários do sistema</p>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all"
          >
            <UserPlus className="w-5 h-5" />
            Novo Usuário
          </button>
        </div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg overflow-hidden"
        >
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Usuário</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Nível</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Empresas</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Criado em</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{user.name || "Sem nome"}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      <Shield className="w-3 h-3 inline mr-1" />
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.companies.slice(0, 3).map((uc) => (
                        <span
                          key={uc.id}
                          className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs flex items-center gap-1"
                        >
                          <Building2 className="w-3 h-3" />
                          {uc.company.name}
                        </span>
                      ))}
                      {user.companies.length > 3 && (
                        <span className="text-xs text-gray-500">+{user.companies.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(user)}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum usuário cadastrado</p>
            </div>
          )}
        </motion.div>

        {/* Create/Edit User Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editingUser ? "Editar Usuário" : "Novo Usuário"}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome do usuário"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="email@exemplo.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editingUser ? "Nova Senha (deixe em branco para manter)" : "Senha *"}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Senha"
                    required={!editingUser}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Acesso</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CONSULTA">Consulta</option>
                    <option value="EDITOR">Editor</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Empresas com Acesso</label>
                  <div className="space-y-2 max-h-40 overflow-auto border rounded-lg p-2">
                    {companies.map((company) => (
                      <label
                        key={company.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.companyIds.includes(company.id)}
                          onChange={() => toggleCompany(company.id)}
                          className="rounded"
                        />
                        <span className="text-sm">{company.name}</span>
                      </label>
                    ))}
                    {companies.length === 0 && (
                      <p className="text-sm text-gray-500 p-2">Nenhuma empresa cadastrada</p>
                    )}
                  </div>
                </div>

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
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {editingUser ? "Salvar" : "Criar"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deletingUser && (
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
                  <h2 className="text-xl font-bold">Excluir Usuário</h2>
                  <p className="text-gray-500 text-sm">Esta ação não pode ser desfeita</p>
                </div>
              </div>

              <p className="text-gray-600 mb-6">
                Tem certeza que deseja excluir o usuário{" "}
                <strong>{deletingUser.name || deletingUser.email}</strong>?
              </p>

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
                    setDeletingUser(null);
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
