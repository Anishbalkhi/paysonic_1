package com.paysonic.tollops.dto;

public class DashboardStatsDTO {

    private long totalUsers;
    private double totalUsersDelta;

    private long activeUsers;
    private double activeUsersDelta;

    private long inactiveUsers;
    private double inactiveUsersDelta;

    private long lockedUsers;
    private double lockedUsersDelta;

    private long failedLoginsToday;
    private double failedLoginsDelta;

    private long totalActivitiesToday;
    private double totalActivitiesDelta;

    private long criticalSecurityEvents;
    private double criticalSecurityEventsDelta;

    private long exportsPerformed;
    private double exportsPerformedDelta;

    public DashboardStatsDTO() {}

    public long getTotalUsers() { return totalUsers; }
    public void setTotalUsers(long totalUsers) { this.totalUsers = totalUsers; }

    public double getTotalUsersDelta() { return totalUsersDelta; }
    public void setTotalUsersDelta(double totalUsersDelta) { this.totalUsersDelta = totalUsersDelta; }

    public long getActiveUsers() { return activeUsers; }
    public void setActiveUsers(long activeUsers) { this.activeUsers = activeUsers; }

    public double getActiveUsersDelta() { return activeUsersDelta; }
    public void setActiveUsersDelta(double activeUsersDelta) { this.activeUsersDelta = activeUsersDelta; }

    public long getInactiveUsers() { return inactiveUsers; }
    public void setInactiveUsers(long inactiveUsers) { this.inactiveUsers = inactiveUsers; }

    public double getInactiveUsersDelta() { return inactiveUsersDelta; }
    public void setInactiveUsersDelta(double inactiveUsersDelta) { this.inactiveUsersDelta = inactiveUsersDelta; }

    public long getLockedUsers() { return lockedUsers; }
    public void setLockedUsers(long lockedUsers) { this.lockedUsers = lockedUsers; }

    public double getLockedUsersDelta() { return lockedUsersDelta; }
    public void setLockedUsersDelta(double lockedUsersDelta) { this.lockedUsersDelta = lockedUsersDelta; }

    public long getFailedLoginsToday() { return failedLoginsToday; }
    public void setFailedLoginsToday(long failedLoginsToday) { this.failedLoginsToday = failedLoginsToday; }

    public double getFailedLoginsDelta() { return failedLoginsDelta; }
    public void setFailedLoginsDelta(double failedLoginsDelta) { this.failedLoginsDelta = failedLoginsDelta; }

    public long getTotalActivitiesToday() { return totalActivitiesToday; }
    public void setTotalActivitiesToday(long totalActivitiesToday) { this.totalActivitiesToday = totalActivitiesToday; }

    public double getTotalActivitiesDelta() { return totalActivitiesDelta; }
    public void setTotalActivitiesDelta(double totalActivitiesDelta) { this.totalActivitiesDelta = totalActivitiesDelta; }

    public long getCriticalSecurityEvents() { return criticalSecurityEvents; }
    public void setCriticalSecurityEvents(long criticalSecurityEvents) { this.criticalSecurityEvents = criticalSecurityEvents; }

    public double getCriticalSecurityEventsDelta() { return criticalSecurityEventsDelta; }
    public void setCriticalSecurityEventsDelta(double criticalSecurityEventsDelta) { this.criticalSecurityEventsDelta = criticalSecurityEventsDelta; }

    public long getExportsPerformed() { return exportsPerformed; }
    public void setExportsPerformed(long exportsPerformed) { this.exportsPerformed = exportsPerformed; }

    public double getExportsPerformedDelta() { return exportsPerformedDelta; }
    public void setExportsPerformedDelta(double exportsPerformedDelta) { this.exportsPerformedDelta = exportsPerformedDelta; }
}
