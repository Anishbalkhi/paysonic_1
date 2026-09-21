package com.paysonic.tollops.dto;

import java.util.List;
import java.util.Map;

public class LoginTrendDTO {
    private int days;
    private List<String> labels;
    private Map<String, List<Integer>> datasets;

    public LoginTrendDTO() {}

    public LoginTrendDTO(int days, List<String> labels, Map<String, List<Integer>> datasets) {
        this.days = days;
        this.labels = labels;
        this.datasets = datasets;
    }

    public int getDays() { return days; }
    public void setDays(int days) { this.days = days; }

    public List<String> getLabels() { return labels; }
    public void setLabels(List<String> labels) { this.labels = labels; }

    public Map<String, List<Integer>> getDatasets() { return datasets; }
    public void setDatasets(Map<String, List<Integer>> datasets) { this.datasets = datasets; }
}
