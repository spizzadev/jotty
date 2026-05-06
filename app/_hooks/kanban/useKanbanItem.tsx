"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Item, Checklist, KanbanPriority, KanbanReminder } from "@/app/_types";
import {
  updateItem,
  deleteItem,
  updateItemStatus,
  archiveItem,
} from "@/app/_server/actions/checklist-item";
import { ConfirmModal } from "@/app/_components/GlobalComponents/Modals/ConfirmationModals/ConfirmModal";
import { useToast } from "@/app/_providers/ToastProvider";

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
  const { showToast } = useToast();
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

  function handleEdit() {
    setIsEditing(true);
    setEditText(item.text);
  }

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

  function handleCancel() {
    setEditText(item.text);
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleCancel();
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    const formData = new FormData();
    formData.append("listId", checklistId);
    formData.append("itemId", item.id);
    formData.append("status", newStatus);
    formData.append("category", category || "Uncategorized");
    const result = await updateItemStatus(formData);
    if (result.success && result.data) {
      onUpdate(result.data as Checklist);
      showToast({ type: "success", title: t("common.success"), message: t("kanban.statusUpdated") });
    }
  };

  const handlePriorityChange = async (priority: KanbanPriority) => {
    const formData = new FormData();
    formData.append("listId", checklistId);
    formData.append("itemId", item.id);
    formData.append("priority", priority);
    formData.append("category", category || "Uncategorized");
    const result = await updateItem(checklist, formData);
    if (result.success && result.data) {
      onUpdate(result.data as Checklist);
    }
  };

  const handleScoreChange = async (score: number) => {
    const formData = new FormData();
    formData.append("listId", checklistId);
    formData.append("itemId", item.id);
    formData.append("score", score.toString());
    formData.append("category", category || "Uncategorized");
    const result = await updateItem(checklist, formData);
    if (result.success && result.data) {
      onUpdate(result.data as Checklist);
    }
  };

  const handleAssigneeChange = async (assignee: string) => {
    const formData = new FormData();
    formData.append("listId", checklistId);
    formData.append("itemId", item.id);
    formData.append("assignee", assignee);
    formData.append("category", category || "Uncategorized");
    const result = await updateItem(checklist, formData);
    if (result.success && result.data) {
      onUpdate(result.data as Checklist);
    }
  };

  const handleReminderSet = async (reminder: KanbanReminder | null) => {
    const formData = new FormData();
    formData.append("listId", checklistId);
    formData.append("itemId", item.id);
    formData.append("reminder", reminder ? JSON.stringify(reminder) : "");
    formData.append("category", category || "Uncategorized");
    const result = await updateItem(checklist, formData);
    if (result.success && result.data) {
      onUpdate(result.data as Checklist);
    }
  };

  const _confirmDelete = async () => {
    const formData = new FormData();
    formData.append("listId", checklistId);
    formData.append("itemId", item.id);
    formData.append("category", category || "Uncategorized");

    const result = await deleteItem(formData);
    if (result.success) {
      showToast({ type: "success", title: t("common.success"), message: t("kanban.itemDeleted") });
      onUpdate({
        id: checklistId,
        title: "",
        type: "kanban",
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
      showToast({ type: "success", title: t("common.success"), message: t("kanban.itemArchived") });
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
    handlePriorityChange,
    handleScoreChange,
    handleAssigneeChange,
    handleReminderSet,
    handleDelete: () => setShowDeleteModal(true),
    handleArchive,
    DeleteModal: () => (
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={_confirmDelete}
        title={t("common.delete")}
        message={t("common.confirmDeleteItem", { itemTitle: item.text })}
        confirmText={t("common.delete")}
        variant="destructive"
      />
    ),
  };
};
