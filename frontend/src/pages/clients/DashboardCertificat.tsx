// import React from "react";
// import './CertificatPremium.css'
// import { useNavigate } from "react-router-dom";

// const DashboardCertificat: React.FC = () => {
// const navigate = useNavigate();

//   // 🔒 protection (si pas connecté)
// // const isAuth = localStorage.getItem("auth");

// // if (!isAuth) {
// //     navigate("/");
// //     return null;
// // }

// // const handleLogout = () => {
// //     localStorage.removeItem("auth");
// //     navigate("/");
// // };

// return (
//     <div style={{ padding: "30px", textAlign: "center" }}>
//         <h1> Voulez-vous un certificat ou un facture ?</h1>

//         <div style={{ marginTop: "30px" }}>
//             <button style={{ margin: "10px", padding: "10px 20px" }}
//                     onClick={() => navigate("/certificat")}
//             >
//                 Facturation d'écolage
//             </button>

//             <button style={{ margin: "10px", padding: "10px 20px" }}
//             onClick={() => navigate("/certificat-premium")}
//             >
//             Certificat de formation
//             </button>
//         </div>

//         {/* <div style={{ marginTop: "40px" }}>
//             <button onClick={handleLogout} style={{ padding: "10px 20px" }}>
//             Déconnecter
//             </button>
//         </div> */}
//     </div>
// );
// };

// export default DashboardCertificat;




// import React from "react";
// import { useNavigate } from "react-router-dom";
// import Sidebar from "../../components/Sidebar";

// const DashboardCertificat: React.FC = () => {
//   const navigate = useNavigate();

//   return (

//     <div className="app-layout">          {/* ← même structure que FacturePage */}
//       <Sidebar section="facture" />       {/* ← la navbar */}
//       <div className="main-content">     {/* ← même structure que FacturePage */}


//     <div style={{ padding: "30px", textAlign: "center" }}>
//       <h1>Voulez-vous un certificat ou une facture ?</h1>

//       <div style={{ marginTop: "30px" }}>
//         <button
//           style={{ margin: "10px", padding: "10px 20px" }}
//           onClick={() => navigate("/page2/certificat")}
//         >
//           Facturation d'écolage
//         </button>

//         <button
//           style={{ margin: "10px", padding: "10px 20px" }}
//           onClick={() => navigate("/certificat-premium")}
//         >
//           Certificat de formation
//         </button>
//       </div>
//     </div>
//   );
// };

// export default DashboardCertificat;


// src/pages/clients/DashboardCertificat.tsx
// import React from "react";
// import { useNavigate } from "react-router-dom";
// import Sidebar from "../../components/Sidebar";

// const DashboardCertificat: React.FC = () => {
//   const navigate = useNavigate();

//   return (
//     <div className="app-layout">
//       <Sidebar section="facture" />
//       <div className="main-content">

//         <div className="top-bar">
//           <span className="top-bar-title">Facture & Ceritficat de reuissite</span>
//         </div>

//         <div style={{ padding: "30px", textAlign: "center" }}>
//           <h1>Voulez-vous un certificat ou une facture ?</h1>

//           <div style={{ marginTop: "30px" }}>
//             <button
//               className="btn btn-primary"
//               style={{ margin: "10px", padding: "10px 20px" }}
//               onClick={() => navigate("/facture/ecolage")}
//             >
//               Facturation d'écolage
//             </button>

//             <button
//               className="btn btn-primary"
//               style={{ margin: "10px", padding: "10px 20px" }}
//               onClick={() => navigate("/facture/certificat")}
//             >
//               Certificat de formation
//             </button>
//           </div>
//         </div>

//       </div>
//     </div>
//   );
// };

// export default DashboardCertificat;


// src/pages/clients/DashboardCertificat.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";

const DashboardCertificat: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="app-layout">
      <Sidebar section="facture" />
      <div className="main-content">

        <div className="top-bar">
          {/* ✅ Titre corrigé */}
          <span className="top-bar-title">Facture & Certificat de réussite</span>
        </div>

        <div style={{ padding: "30px", textAlign: "center" }}>
          <h1>Voulez-vous un certificat ou une facture ?</h1>

          <div style={{ marginTop: "30px" }}>
            {/* ✅ Route mise à jour → /facture/ecolage */}
            <button
              className="btn btn-primary"
              style={{ margin: "10px", padding: "10px 20px" }}
              onClick={() => navigate("/facture/ecolage")}
            >
              Facturation d'écolage
            </button>

            {/* ✅ Route mise à jour → /facture/certificat */}
            <button
              className="btn btn-primary"
              style={{ margin: "10px", padding: "10px 20px" }}
              onClick={() => navigate("/facture/certificat")}
            >
              Certificat de formation
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardCertificat;