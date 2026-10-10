package com.paysonic.tollops.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "dispute_batches", indexes = {
    @Index(name = "idx_batch_id", columnList = "batch_id")
})
public class DisputeBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", length = 64, nullable = false, unique = true)
    private String batchId;

    @Column(name = "file_name", length = 255, nullable = false)
    private String fileName;

    @Column(name = "uploaded_by", length = 100, nullable = false)
    private String uploadedBy = "Master Admin";

    @Column(name = "upload_timestamp", nullable = false)
    private LocalDateTime uploadTimestamp;

    @Column(name = "total_rows", nullable = false)
    private Integer totalRows = 0;

    @Column(name = "matched_rows", nullable = false)
    private Integer matchedRows = 0;

    @Column(name = "unmatched_rows", nullable = false)
    private Integer unmatchedRows = 0;

    @Column(name = "duplicate_rows", nullable = false)
    private Integer duplicateRows = 0;

    @Column(name = "status", length = 32, nullable = false)
    private String status = "Processed";

    @PrePersist
    public void prePersist() {
        if (uploadTimestamp == null) {
            uploadTimestamp = LocalDateTime.now();
        }
        if (uploadedBy == null) {
            uploadedBy = "Master Admin";
        }
        if (status == null) {
            status = "Processed";
        }
    }

    public DisputeBatch() {}

    public DisputeBatch(String batchId, String fileName, String uploadedBy, LocalDateTime uploadTimestamp,
                        Integer totalRows, Integer matchedRows, Integer unmatchedRows, Integer duplicateRows, String status) {
        this.batchId = batchId;
        this.fileName = fileName;
        this.uploadedBy = uploadedBy;
        this.uploadTimestamp = uploadTimestamp != null ? uploadTimestamp : LocalDateTime.now();
        this.totalRows = totalRows;
        this.matchedRows = matchedRows;
        this.unmatchedRows = unmatchedRows;
        this.duplicateRows = duplicateRows;
        this.status = status;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(String uploadedBy) { this.uploadedBy = uploadedBy; }

    public LocalDateTime getUploadTimestamp() { return uploadTimestamp; }
    public void setUploadTimestamp(LocalDateTime uploadTimestamp) { this.uploadTimestamp = uploadTimestamp; }

    public Integer getTotalRows() { return totalRows; }
    public void setTotalRows(Integer totalRows) { this.totalRows = totalRows; }

    public Integer getMatchedRows() { return matchedRows; }
    public void setMatchedRows(Integer matchedRows) { this.matchedRows = matchedRows; }

    public Integer getUnmatchedRows() { return unmatchedRows; }
    public void setUnmatchedRows(Integer unmatchedRows) { this.unmatchedRows = unmatchedRows; }

    public Integer getDuplicateRows() { return duplicateRows; }
    public void setDuplicateRows(Integer duplicateRows) { this.duplicateRows = duplicateRows; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
