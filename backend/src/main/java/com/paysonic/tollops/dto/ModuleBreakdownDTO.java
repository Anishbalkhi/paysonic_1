package com.paysonic.tollops.dto;

public class ModuleBreakdownDTO {
    private String name;
    private long count;
    private int percentage;

    public ModuleBreakdownDTO() {}

    public ModuleBreakdownDTO(String name, long count, int percentage) {
        this.name = name;
        this.count = count;
        this.percentage = percentage;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public long getCount() { return count; }
    public void setCount(long count) { this.count = count; }

    public int getPercentage() { return percentage; }
    public void setPercentage(int percentage) { this.percentage = percentage; }
}
