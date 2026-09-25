package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "plazas")
public class Plaza {

    @Id
    @Column(name = "id", length = 32, nullable = false)
    private String id;

    @Column(name = "name", length = 120, nullable = false)
    private String name;

    @Column(name = "org_id", length = 50)
    private String orgId;

    @Column(name = "agency_id", length = 50)
    private String agencyId;

    @Column(name = "concessionaire_id", length = 32)
    private String concessionaireId;

    @Column(name = "category", length = 50, nullable = false)
    private String category = "Toll";

    @Column(name = "base_pricing", length = 50, nullable = false)
    private String basePricing = "Distance Based";

    @Column(name = "plaza_interface", length = 50, nullable = false)
    private String plazaInterface = "API";

    @Column(name = "subtype", length = 50, nullable = false)
    private String subtype = "National";

    @Column(name = "authority", length = 50, nullable = false)
    private String authority = "NHAI";

    @Column(name = "state", length = 80)
    private String state;

    @Column(name = "city", length = 80)
    private String city;

    @Column(name = "activation_date", length = 30)
    private String activationDate;

    @Column(name = "geo_code", length = 80)
    private String geoCode;

    @Column(name = "scheme_rule", length = 50)
    private String schemeRule = "Single Return";

    @Column(name = "scheme_duration", length = 50)
    private String schemeDuration = "24 Hrs";

    @Column(name = "status", length = 30, nullable = false)
    private String status = "Active";

    @Column(name = "public_key", columnDefinition = "TEXT")
    private String publicKey;

    @Column(name = "contact_address", length = 255)
    private String contactAddress;

    @Column(name = "contact_no", length = 30)
    private String contactNo;

    @Column(name = "contact_mail", length = 120)
    private String contactMail;

    @Column(name = "mdr_json", columnDefinition = "TEXT")
    private String mdrJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Plaza() {}

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getOrgId() { return orgId; }
    public void setOrgId(String orgId) { this.orgId = orgId; }

    public String getAgencyId() { return agencyId; }
    public void setAgencyId(String agencyId) { this.agencyId = agencyId; }

    public String getConcessionaireId() { return concessionaireId; }
    public void setConcessionaireId(String concessionaireId) { this.concessionaireId = concessionaireId; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getBasePricing() { return basePricing; }
    public void setBasePricing(String basePricing) { this.basePricing = basePricing; }

    public String getPlazaInterface() { return plazaInterface; }
    public void setPlazaInterface(String plazaInterface) { this.plazaInterface = plazaInterface; }

    public String getSubtype() { return subtype; }
    public void setSubtype(String subtype) { this.subtype = subtype; }

    public String getAuthority() { return authority; }
    public void setAuthority(String authority) { this.authority = authority; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getActivationDate() { return activationDate; }
    public void setActivationDate(String activationDate) { this.activationDate = activationDate; }

    public String getGeoCode() { return geoCode; }
    public void setGeoCode(String geoCode) { this.geoCode = geoCode; }

    public String getSchemeRule() { return schemeRule; }
    public void setSchemeRule(String schemeRule) { this.schemeRule = schemeRule; }

    public String getSchemeDuration() { return schemeDuration; }
    public void setSchemeDuration(String schemeDuration) { this.schemeDuration = schemeDuration; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPublicKey() { return publicKey; }
    public void setPublicKey(String publicKey) { this.publicKey = publicKey; }

    public String getContactAddress() { return contactAddress; }
    public void setContactAddress(String contactAddress) { this.contactAddress = contactAddress; }

    public String getContactNo() { return contactNo; }
    public void setContactNo(String contactNo) { this.contactNo = contactNo; }

    public String getContactMail() { return contactMail; }
    public void setContactMail(String contactMail) { this.contactMail = contactMail; }

    public String getMdrJson() { return mdrJson; }
    public void setMdrJson(String mdrJson) { this.mdrJson = mdrJson; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
