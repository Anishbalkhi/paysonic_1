package com.paysonic.tollops.dto;

public class ExportResponseDTO {
    private String data;
    private String filename;
    private String mimeType;
    private int recordCount;

    public ExportResponseDTO() {}

    public ExportResponseDTO(String data, String filename, String mimeType, int recordCount) {
        this.data = data;
        this.filename = filename;
        this.mimeType = mimeType;
        this.recordCount = recordCount;
    }

    public String getData() { return data; }
    public void setData(String data) { this.data = data; }

    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }

    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }

    public int getRecordCount() { return recordCount; }
    public void setRecordCount(int recordCount) { this.recordCount = recordCount; }
}
