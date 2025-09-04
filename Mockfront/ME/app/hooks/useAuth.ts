"use client";
import { useState } from "react";

// Types des rôles possibles
type UserRole = "operator" | "partner" | "client";

interface User {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  partnerId?: number;
  clientId?: number;
}

export default function useAuth() {
  // 🔧 MODIFIE ICI POUR CHANGER DE PERSONNE
  // ================================================
  
  // Pour tester un OPÉRATEUR :
  // const [currentRole] = useState<UserRole>("operator");
  // const currentUserId = 1; // ID de l'opérateur dans core.operateurs

  // Pour tester un PARTENAIRE :
  // const [currentRole] = useState<UserRole>("partner");
  // const currentUserId = 1; // partner_id dans core.partenaires

  // Pour tester un CLIENT :
  const [currentRole] = useState<UserRole>("client");
  const currentUserId = 1; // ID du client dans core.clients

  // ================================================

  // Construire l'objet user selon le rôle
  function getCurrentUser(): User | null {
    switch (currentRole) {
      case "operator":
        return {
          id: `operator-${currentUserId}`,
          role: "operator",
          name: `Opérateur ${currentUserId}`,
          email: `operateur${currentUserId}@lebdf.fr`
        };

      case "partner":
        return {
          id: `partner-${currentUserId}`,
          role: "partner",
          name: `Partenaire ${currentUserId}`,
          email: `partenaire${currentUserId}@example.fr`,
          partnerId: currentUserId
        };

      case "client":
        return {
          id: `client-${currentUserId}`,
          role: "client",
          name: `Client ${currentUserId}`,
          email: `client${currentUserId}@example.fr`,
          clientId: currentUserId
        };

      default:
        return null;
    }
  }

  const user = getCurrentUser();

  return {
    user,
    switchRole: (newRole: UserRole) => {
      console.log(
        `Pour changer de rôle, modifie le hook useAuth.ts avec role: '${newRole}'`
      );
    },
    can: {
      seeAllDossiers: currentRole === "operator",
      seeCommercial: currentRole === "operator",
      seeExports: currentRole === "operator",
      createTickets: true,
      editDossiers: currentRole === "operator",
      seePartnerData: ["operator", "partner"].includes(currentRole),
      seeFinancialData: currentRole === "operator"
    }
  };
}
