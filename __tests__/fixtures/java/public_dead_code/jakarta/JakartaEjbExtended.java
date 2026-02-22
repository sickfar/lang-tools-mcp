package com.example;

import jakarta.ejb.Singleton;
import jakarta.ejb.Schedule;

@Singleton
public class EjbSingleton {
    @Schedule(hour = "*")
    public void scheduledTask() {}
}
