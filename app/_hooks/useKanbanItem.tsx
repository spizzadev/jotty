"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Item, Checklist } from "@/app/_types";
import {
  updateItem,
  deleteItem,
  updateItemStatus,
  archiveItem,
} from "@/app/_server/actions/checklist-item";
import { ConfirmModal } from "@/app/_components/GlobalComponents/Modals/ConfirmationModals/ConfirmModal";

interface UseKanbanItemProps {
  item: Item;
  checklist: Checklist;
  checklistId: string;
  category: string;
  onUpdate: (updatedChecklist: Checklist) => void;
}

export const useKanbanItem = ({
  item,
  checklist,
  checklistId,
  category,
  onUpdate,
}: UseKanbanItemProps) => {
  const t = useTranslations();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditText(item.text);
  };

  const handleSave = async () => {
    setIsEditing(false);
    if (editText.trim() && editText !== item.text) {
      const formData = new FormData();
      formData.append("listId", checklistId);
      formData.append("itemId", item.id);
      formData.append("text", editText.trim());
      formData.append("category", category || "Uncategorized");

      const result = await updateItem(checklist, formData);
      if (result.success && result.data) {
        onUpdate(result.data as Checklist);
      }
    }
  };

  const handleCancel = () => {
    setEditText(item.text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleCancel();
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    const formData = new FormData();
    formData.append("listId", checklistId);
    formData.append("itemId", item.id);
    formData.append("status", newStatus);
    formData.append("category", category || "Uncategorized");
    const result = await updateItemStatus(formData);
    if (result.success && result.data) {
      onUpdate(result.data as Checklist);
    }
  };

  const confirmDelete = async () => {
    const formData = new FormData();
    formData.append("listId", checklistId);
    formData.append("itemId", item.id);
    formData.append("category", category || "Uncategorized");

    const result = await deleteItem(formData);
    if (result.success) {
      onUpdate({
        id: checklistId,
        title: "",
        type: "task",
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category,
        isDeleted: true,
      });
    }
    setShowDeleteModal(false);
  };

  const handleArchive = async () => {
    const formData = new FormData();
    formData.append("listId", checklistId);
    formData.append("itemId", item.id);
    formData.append("category", category || "Uncategorized");

    const result = await archiveItem(formData);
    if (result.success && result.data) {
      onUpdate(result.data as Checklist);
    }
  };

  return {
    isEditing,
    editText,
    setEditText,
    inputRef,
    handleEdit,
    handleSave,
    handleCancel,
    handleKeyDown,
    handleStatusChange,
    handleDelete: () => setShowDeleteModal(true),
    handleArchive,
    DeleteModal: () => (
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title={t("common.delete")}
        message={t("common.confirmDeleteItem", { itemTitle: item.text })}
        confirmText={t("common.delete")}
        variant="destructive"
      />
    ),
  };
};
